let url = "https://himawari8-dl.nict.go.jp/himawari8";
let timeStampPath = "/img/FULL_24h/latest.json?_=$unix_time",
	imgPath = "/img/D531106/4d/550/";

let firstLoad = true,
	showBorder = false,
	draggable = false;

let position = new Array(), // 图片区域，发请求用
	loaded = new Array(16), // 标记 16 个区域是否加载完成
	imgs = new Array(16), // Image 对象，预加载图片
	default_imgs = new Array(), // 默认图片，第一次请求失败时使用
	earthImgs; // 16 个区域的 <img> 元素

let originalSize = 2200, // setSize() 后的原始尺寸
	maxSize = 2200, // 最大尺寸
	minSize = 275, // 最小尺寸
	noBorderSize; // 保存显示边框前的尺寸
	
let scaleStep = 0.1; // 缩放步长
let loadIndex;

for (let i = 0; i < 4; i++) {
	for (let j = 0; j < 4; j++) {
		default_imgs.push("./img/" + j + "" + i + ".png");
		position.push("_" + j + "_" + i + ".png");
	}
}

for (let i = 0; i < 16; i++) {
	imgs[i] = new Image();
	loaded[i] = false;
}

$(document).ready(() => {
	earthImgs = $(".earth-image")
	$(earthImgs).attr("draggable", "false");
	setSize();
	setTimeout(getEarth, 1000);
	setInterval(getEarth, 5 * 60 * 1000);
	setInterval(setImage, 5000);
});

function toggleDraggable() {
	draggable = !draggable;
	console.log(draggable);
	$("#earth").draggable({
		disabled: !draggable
	});
	if (draggable) {
		$("#draggable").css("background-color", "#FF9900");
	} else {
		$("#draggable").css("background-color", "#333333");
	}
}

/**
 * 设置缩放尺寸
 */
function setScale(earthSize) {
	let len = earthSize / 4;

	$(".earth").css("width", earthSize + "px").css("height", earthSize + "px");
	$(".earth-part").css("width", len + "px").css("height", len + "px");

	$(".earth-01, .earth-11, .earth-21, .earth-31").css("top", len + "px");
	$(".earth-02, .earth-12, .earth-22, .earth-32").css("top", len * 2 + "px");
	$(".earth-03, .earth-13, .earth-23, .earth-33").css("top", len * 3 + "px");

	$(".earth-10, .earth-11, .earth-12, .earth-13").css("left", len + "px");
	$(".earth-20, .earth-21, .earth-22, .earth-23").css("left", len * 2 + "px");
	$(".earth-30, .earth-31, .earth-32, .earth-33").css("left", len * 3 + "px");
}

/**
 * 根据可视区域大小设置地球尺寸
 */
function setSize() {
	let width = document.body.clientWidth,
		height = document.body.clientHeight;
	let minLength = height < width ? height : width;

	if (minLength < maxSize) {
		let scale = (minLength - 100) / maxSize;
		let earthSize = Math.round(maxSize * scale);
		originalSize = earthSize;
		setScale(earthSize);
	}
}

/**
 * 预加载图片
 */
function loadImage(time) {
    for (let i = 0; i < 16; i++) {
        imgs[i].onload = () => {
            loaded[i] = true;
            console.log("part " + i + " loaded.");
            // 修正图像
            imgs[i] = correctImage(imgs[i]);
        };
        imgs[i].onerror = () => {
            loaded[i] = false;
            console.log("part " + i + " can not load.");
        }
        imgs[i].src = url + imgPath + time + position[i];
    }
}

/**
 * 修正图像
 */
function correctImage(img) {
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;

    // 色阶提高到 1.30
    const inBlack = [0, 0, 0];
    const inWhite = [255, 255, 255];
    const inGamma = [1.3, 1.3, 1.3]; // Using 1.3 as thresholds for RGB
    const outBlack = [0, 0, 0];
    const outWhite = [255, 255, 255];

    for (let i = 0; i < data.length; i += 4) {
        // Process RGB channels (skip alpha)
        for (let c = 0; c < 3; c++) {
            // Normalize to 0-1 range
            let normalized = (data[i + c] - inBlack[c]) / (inWhite[c] - inBlack[c]);
            // Clamp to valid range
            normalized = Math.max(0, Math.min(1, normalized));
            // Apply gamma correction
            let gammaCorrect = Math.pow(normalized, 1 / inGamma[c]);
            // Scale to output range
            data[i + c] = Math.round(gammaCorrect * (outWhite[c] - outBlack[c]) + outBlack[c]);
        }
    }

    // 增加 15% 的饱和度
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        let avg = (r + g + b) / 3;
        data[i] = r + (r - avg) * 0.15;
        data[i + 1] = g + (g - avg) * 0.15;
        data[i + 2] = b + (b - avg) * 0.15;
    }

    // 调整通道颜色
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        data[i] = r * 0.8 + g * 0.2; // Red channel
        data[i + 1] = g * 0.66 + r * 0.33; // Green channel
        data[i + 2] = b * 0.8 + r * 0.2; // Blue channel
    }

    // 色阶提高到 1.40
    const inGamma2 = [1.4, 1.4, 1.4]; // Using 1.4 as thresholds for RGB

    for (let i = 0; i < data.length; i += 4) {
        // Process RGB channels (skip alpha)
        for (let c = 0; c < 3; c++) {
            // Normalize to 0-1 range
            let normalized = (data[i + c] - inBlack[c]) / (inWhite[c] - inBlack[c]);
            // Clamp to valid range
            normalized = Math.max(0, Math.min(1, normalized));
            // Apply gamma correction
            let gammaCorrect = Math.pow(normalized, 1 / inGamma2[c]);
            // Scale to output range
            data[i + c] = Math.round(gammaCorrect * (outWhite[c] - outBlack[c]) + outBlack[c]);
        }
    }

    ctx.putImageData(imageData, 0, 0);
    let correctedImg = new Image();
    correctedImg.src = canvas.toDataURL();
    return correctedImg;
}

/**
 * 同时显示 16 个区域
 */
function setImage() {
	let all_loaded = true;
	for (let i = 0; i < 16; i++) {
		if (!loaded[i]) {
			all_loaded = false;
			break;
		}
	}
	// 全部加载完毕时同时显示，避免刷新时出现部分缺失
	if (all_loaded) {
		layer.close(loadIndex);
		for (let i = 0; i < 16; i++) {
			$(earthImgs[i]).attr("src", imgs[i].src);
		}

		for (let i = 0; i < 16; i++) loaded[i] = false;

		layer.msg("Synchronized", {
			icon: 1,
			time: 1500,
			offset: "t",
			anim: 1
		});

		$("#controll").css("opacity", "0");
	}
}

/**
 * 获取实时地球图片
 */
function getEarth() {
	loadIndex = layer.msg("Synchronizing...", {
		icon: 16,
		time: 0,
		offset: "t",
		anim: 1
	});
	getServerTime((time) => {
		loadImage(time);
	});
}

/**
 * 用当前时间获取服务器上的最新时间戳
 */
function getServerTime(callback) {
	$.ajax({
		url: url + timeStampPath.replace("$unix_time", getUnixTime),
		type: 'get',
		success: (data) => {
			firstLoad = false;
			console.log(data);
			callback(dateFormat("YYYY/mm/dd/HHMMSS", new Date(data.date)));
		},
		error: () => {
			console.log("Failed to load!");
			layer.msg("Failed to synchronize!", {
				icon: 7,
				time: 2000,
				offset: "t",
				anim: 1
			});
			// 首次加载失败显示默认图像
			if (firstLoad) {
				firstLoad = false;
				setDefaultImage();
			}
		}
	});
}

/**
 * 加载失败时显示未修正的默认图片
 */
function setDefaultImage() {
	for (let i = 0; i < default_imgs.length; i++) {
		$(earthImgs[i]).attr("src", default_imgs[i]);
	}
}

/**
 * 缩放
 */
function zoom(direction) {
	if (direction > 0) {
		let size = originalSize * (1 + scaleStep);
		originalSize = (size <= maxSize ? size : maxSize);
		setScale(originalSize);
	} else {
		let size = originalSize * (1 - scaleStep);
		originalSize = (size >= minSize ? size : minSize);
		setScale(originalSize);
	}
}

/**
 * 切换边框显示和隐藏
 */
function toggleBorder() {
	let border;

	if (!showBorder) {
		let size = originalSize * 0.67;
		noBorderSize = originalSize
		originalSize = size;
		setScale(size);
		border = "url(./resources/border_window.png)";
		$("#toggle-border").css("background-color", "#FF9900");
	} else {
		originalSize = noBorderSize;
		setScale(noBorderSize);
		border = "none";
		$("#toggle-border").css("background-color", "#333333");
	}
	showBorder = !showBorder;
	$("#border").css("background-image", border);
}

function getUnixTime() {
	return Math.round(new Date().getTime());
}

function dateFormat(fmt, date) {
	let ret;
	const opt = {
		"Y+": date.getFullYear().toString(),
		"m+": (date.getMonth() + 1).toString(),
		"d+": date.getDate().toString(),
		"H+": date.getHours().toString(),
		"M+": date.getMinutes().toString(),
		"S+": date.getSeconds().toString()
	};
	for (let k in opt) {
		ret = new RegExp("(" + k + ")").exec(fmt);
		if (ret) {
			fmt = fmt.replace(ret[1], (ret[1].length == 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, "0")))
		};
	};
	return fmt;
}
