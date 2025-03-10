// 配置参数
const slices = 4;              // 分块数量（4×4）
const baseTileSize = 550;        // 每个图块的原始尺寸（550x550）
const targetSize = 1500;         // 最终处理后的图片尺寸（1500x1500）
const updateInterval = 10 * 60 * 1000;  // 每10分钟更新一次

// 获取格式化后的时间（向日葵卫星数据延迟约30分钟，且数据时间为整10分钟）
function getFormattedTime() {
  const minutesBefore = 30;
  let utcTime = new Date(Date.now() + (new Date().getTimezoneOffset() * 60000)); // 当前UTC时间
  // 减去30分钟及余下的不足10分钟部分
  utcTime.setMinutes(utcTime.getMinutes() - minutesBefore - (utcTime.getMinutes() % 10));
  utcTime.setSeconds(0);
  utcTime.setMilliseconds(0);
  return utcTime;
}

// 数字补零
function pad(number, length) {
  return String(number).padStart(length, '0');
}

// 主函数：获取图块、拼接、处理并更新背景
function fetchAndProcessImage() {
  const formattedTime = getFormattedTime();
  const year = formattedTime.getUTCFullYear();
  const month = pad(formattedTime.getUTCMonth() + 1, 2);
  const day = pad(formattedTime.getUTCDate(), 2);
  const hour = pad(formattedTime.getUTCHours(), 2);
  const minute = pad(formattedTime.getUTCMinutes(), 2);
  const second = pad(formattedTime.getUTCSeconds(), 2);
  const timeStr = `${hour}${minute}${second}`;
  
  // 每个图块的 URL 格式（注意此处写死为 "4d" 表示4×4 拼图）
  // URL 格式示例：
  // https://himawari8.nict.go.jp/img/D531106/4d/550/2025/03/10/HHMMSS/i_j.png
  let promises = [];
  for (let i = 0; i < slices; i++) {
    for (let j = 0; j < slices; j++) {
      const url = `https://himawari8.nict.go.jp/img/D531106/4d/550/${year}/${month}/${day}/${timeStr}/${i}_${j}.png`;
      promises.push(new Promise((resolve, reject) => {
        const img = new Image();
        // 尝试使用跨域加载，确保后续 canvas 操作不被“污染”
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve({ img, i, j });
        img.onerror = () => reject(`加载图片失败：${url}`);
        img.src = url;
      }));
    }
  }
  
  Promise.all(promises).then(results => {
    // 创建一个临时 canvas 用于拼接图块（尺寸为 4 * 550 = 2200px）
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = slices * baseTileSize;
    gridCanvas.height = slices * baseTileSize;
    const gridCtx = gridCanvas.getContext('2d');
    
    // 将每个图块绘制到正确位置
    results.forEach(({ img, i, j }) => {
      gridCtx.drawImage(img, i * baseTileSize, j * baseTileSize, baseTileSize, baseTileSize);
    });
    
    // 将拼接后的图像缩放至 targetSize（1500x1500）
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetSize;
    finalCanvas.height = targetSize;
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.drawImage(gridCanvas, 0, 0, gridCanvas.width, gridCanvas.height, 0, 0, targetSize, targetSize);
    
    // 获取图像数据以便后续处理
    let imageData = finalCtx.getImageData(0, 0, targetSize, targetSize);
    let data = imageData.data;
    
    // 辅助函数：使用伽马（levels）校正，公式：new = (v/255)^(1/gamma)*255
    function applyLevels(gamma) {
      for (let k = 0; k < data.length; k += 4) {
        data[k]   = Math.pow(data[k] / 255, 1 / gamma) * 255;     // R
        data[k+1] = Math.pow(data[k+1] / 255, 1 / gamma) * 255;   // G
        data[k+2] = Math.pow(data[k+2] / 255, 1 / gamma) * 255;   // B
      }
    }
    
    // 第一步：伽马校正，使用 gamma = 1.30
    applyLevels(1.30);
    
    // 第二步：增加饱和度 15%
    // 利用 RGB 与 HSL 之间的转换
    function rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return [h, s, l];
    }
    
    function hslToRgb(h, s, l) {
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p, q, t) => {
          if(t < 0) t += 1;
          if(t > 1) t -= 1;
          if(t < 1/6) return p + (q - p) * 6 * t;
          if(t < 1/2) return q;
          if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return [r * 255, g * 255, b * 255];
    }
    
    for (let k = 0; k < data.length; k += 4) {
      let r = data[k], g = data[k+1], b = data[k+2];
      let [h, s, l] = rgbToHsl(r, g, b);
      s = Math.min(s * 1.15, 1);  // 增加15%
      [r, g, b] = hslToRgb(h, s, l);
      data[k] = r;
      data[k+1] = g;
      data[k+2] = b;
    }
    
    // 第三步：通道混合
    // newR = 0.2 * G + 0.8 * R
    // newG = 0.33 * R + 0.66 * G
    // newB = 0.2 * R + 0.8 * B
    for (let k = 0; k < data.length; k += 4) {
      const r = data[k], g = data[k+1], b = data[k+2];
      data[k]   = 0.2 * g + 0.8 * r;
      data[k+1] = 0.33 * r + 0.66 * g;
      data[k+2] = 0.2 * r + 0.8 * b;
    }
    
    // 第四步：再次伽马校正，使用 gamma = 1.40
    applyLevels(1.40);
    
    // 将处理后的数据放回 canvas
    finalCtx.putImageData(imageData, 0, 0);
    
    // 在图片下方添加时间戳
    finalCtx.font = "25px sans-serif";
    finalCtx.fillStyle = "rgba(100,100,100,0.4)";
    const timestamp = "Last Update: " + formattedTime.toLocaleString();
    const textMetrics = finalCtx.measureText(timestamp);
    finalCtx.fillText(timestamp, (targetSize - textMetrics.width) / 2, targetSize - 50);
    
    // 最后将生成的图片转为 data URL，设置为页面背景
    const dataURL = finalCanvas.toDataURL();
    document.getElementById('background').style.backgroundImage = `url(${dataURL})`;
    
  }).catch(err => {
    console.error(err);
  });
}

// 初始调用
fetchAndProcessImage();
// 每10分钟更新一次
setInterval(fetchAndProcessImage, updateInterval);
