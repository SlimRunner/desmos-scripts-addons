// ==UserScript==
// @name        Desmovie
// @namespace   slidav.Desmos
// @version     1.0.0
// @author      SlimRunner (David Flores)
// @description CLI style library to capture video in Desmos
// @grant       none
// @match       https://*.desmos.com/calculator*
// @require     https://unpkg.com/@ffmpeg/ffmpeg@0.9.6/dist/ffmpeg.min.js
// @downloadURL https://github.com/SlimRunner/desmos-scripts-addons/raw/master/desmovie-script/desmovie.user.js
// @updateURL   https://github.com/SlimRunner/desmos-scripts-addons/raw/master/desmovie-script/desmovie.user.js
// ==/UserScript==

(function() {
	'use strict';
	const { createFFmpeg, fetchFile } = FFmpeg;
	const ffmpeg = createFFmpeg({ log: true });
	
	var Calc;
	defineScript();
	
	class DescreenShot {
		constructor(options) {
			this.options = new SSOptions(options);
			this.filename = 'untitled';
			this.dataURI = '';
		}
		
		async genImageURI() {
			this.dataURI = await this.getAsyncScreenshot();
			return this.dataURI;
		}
		
		getAsyncScreenshot() {
			const options = this.options.obj;
			return new Promise ((resolve, reject) => {
				Calc.asyncScreenshot(options, data => resolve(data));
			});
		}
		
		saveImage() {
			this.genImageURI().then((imgData) => {
				let url;
				if (this.options.format === 'svg') {
					let file = new Blob([imgData], {type: 'image/svg+xml;charset=utf-8'});
					url = URL.createObjectURL(file);
				} else {
					url = imgData;
				}
				let filename = this.filename || 'untitled';
				if (window.navigator.msSaveOrOpenBlob) { // IE10+
					window.navigator.msSaveOrOpenBlob(url, filename);
				} else { // Others
					var a = document.createElement("a");
					a.href = url;
					a.download = filename;
					document.body.appendChild(a);
					a.click();
					setTimeout(function() {
						document.body.removeChild(a);
						window.URL.revokeObjectURL(url);  
					}, 0); 
				}
			});
		}
	}
	
	class SSOptions {
		constructor(
			{
				width = 640,
				height = 480,
				targetPixelRatio,
				preserveAxisNumbers,
				format,
				mathBounds,
				showLabels,
				mode
			} = {}
		) {
			this._width = width;
			this._height = height;
			this._targetPixelRatio = targetPixelRatio || null;
			this._preserveAxisNumbers = preserveAxisNumbers || null;
			this._format = format || null;
			this._mathBounds = mathBounds || null;
			this._showLabels = showLabels || null;
			this._mode = mode || null;
		}
		
		set width(val) {
			if (val <= 0) throw new Error('width cannot be zero or less');
			this._width = val || this._width;
		}
		
		set height(val) {
			if (val <= 0) throw new Error('height cannot be zero or less');
			this._height = val || this._height;
		}
		
		set targetPixelRatio(val) {
			if (val <= 0) throw new Error('targetPixelRatio cannot be zero or less');
			this._targetPixelRatio = val || this._targetPixelRatio;
		}
		
		set preserveAxisNumbers(val = false) {
			if (!isBoolean(val)) throw new Error('preserveAxisNumbers must be boolean');
			this._preserveAxisNumbers = val;
		}
		
		set format(val) {
			switch (true) {
				case val == null:
					this._format = null;
					break;
				case val === 'png':
				case val === 'svg':
					this._format = val;
					break;
				default:
					throw new Error(`${val} is not a supported format`);
			}
		}
		
		set showLabels(val = false) {
			if (!isBoolean(val)) throw new Error('showLabels must be boolean');
			this._showLabels = val;
		}
		
		set mode(str = 'contain') {
			this._mode = str;
		}
		
		setResolution(width, height) {
			try {
				this.width = width;
			} catch (e) {
				console.warn(e.message);
			}
			try {
				this.height = height;
			} catch (e) {
				console.warn(e.message);
			}
		}
		
		setMathBounds(left, right, bottom, top) {
			if (
				left == null ||
				right == null ||
				bottom == null ||
				top == null
			) throw new Error('all parameters must be provided');
			
			if (left > right) throw new Error('left cannot be less than right');
			if (bottom > top) throw new Error('bottom cannot be less than top');
			
			this._mathBounds = {
				left: left,
				right: right,
				bottom: bottom,
				top: top
			};
		}
		
		clearMathBounds() {
			this._mathBounds = null;
		}
		
		get width() {
			return this._width
		}
	
		get height() {
			return this._height
		}
	
		get targetPixelRatio() {
			return this._targetPixelRatio
		}
	
		get preserveAxisNumbers() {
			return this._preserveAxisNumbers
		}
	
		get format() {
			return this._format
		}
	
		get mathBounds() {
			return this._mathBounds
		}
	
		get showLabels() {
			return this._showLabels
		}
		
		get mode() {
			return his._mode;
		}
		
		get obj() {
			let source = {
				width: this._width,
				height: this._height,
				targetPixelRatio: this._targetPixelRatio,
				preserveAxisNumbers: this._preserveAxisNumbers,
				format: this._format,
				mathBounds: this._mathBounds,
				showLabels: this._showLabels,
				mode: this._mode
			};
			let retval = {};
			
			for (var prop in source) {
				if (source.hasOwnProperty(prop) && source[prop] != null) {
					retval[prop] = source[prop];
				}
			}
			
			return retval;
		}
	}
	
	class SliderExp {
		constructor({
			start = 0, end = 9, step = 1
		}) {
			if (Math.sign(end - start) === Math.sign(step)) {
				this._start = start;
				this._end = end;
				this._step = step;
			} else {
				throw new Error(`With a step of ${step}, start will never get to end.`);
			}
		}
		
		get start() {
			return this._start;
		}
		
		get end() {
			return this._end;
		}
		
		get step() {
			return this._step;
		}
		
		setInterval(start, end, step) {
			if (Math.sign(end - start) === Math.sign(step)) {
				this._start = start;
				this._end = end;
				this._step = step;
			} else {
				throw new Error(`With a step of ${step}, start will never get to end.`);
			}
		}
	}
	
	class SimulationExp {
		constructor({
			quota = 10,
			condition
		}) {
			if (condition == null) {
				this._type = SimulationExp.Types.FRAMEQUOTA;
			} else {
				this._type = SimulationExp.Types.CONDITIONAL;
			}
			
			this._quota = quota;
			this.condition = condition || null;
		}
		
		set type(val) {
			switch (val) {
				case SimulationExp.Types.FRAMEQUOTA:
				case SimulationExp.Types.CONDITIONAL:
					this._type = val;
					break;
				default:
					console.warn('Not a valid type. Change ignored');
			}
		}
		
		get type() {
			switch (this._type) {
				case SimulationExp.Types.FRAMEQUOTA:
					return {index: this._type, name: 'quota'};
				case SimulationExp.Types.CONDITIONAL:
					return {index: this._type, name: 'conditional'};
				default:
					return null;
			}
		}
		
		set quota(num) {
			if (num <= 0) throw new Error('quota must be a positive non-zero number');
			
			this._quota = num;
		}
		
		get quota() {
			return this._quota;
		}
		
		static Types = Object.freeze({
			FRAMEQUOTA: 0,
			CONDITIONAL: 1
		});
	}
	
	class Desmovie {
		constructor(dss, {
			id, index,
			framerate = 30,
			format = Desmovie.Formats.MP4,
			loop = true,
			start,
			end,
			step,
			quota,
			condition,
		} = {}) {
			this._capture = dss || new DescreenShot();
			// There is probably a better way to make these checks
			if (id == null && index == null) throw new Error('Invalid id/index');
			if (id == null) {
				id = Calc.controller.getItemModelByIndex(index).id;
			}
			if (id == null) throw new Error('Invalid index');
			this.ID = id;
			
			let expModel = Calc.controller.getItemModel(id);
			
			if (expModel.type === 'simulation') {
				this._type = 'sim';
				this.options = new SimulationExp({
					quota: quota, condition: condition
				});
			} else if (
				expModel.type === 'expression' &&
				expModel.sliderExists
			) {
				this._type = 'slider';
				this.options = new SliderExp({
					start: start, end: end, step: step
				});
				console.log('slider options set to default');
			}
			
			this._format = format;
			this._framerate = framerate;
			this.loop = loop;
			this._shortcircuit = false;
		}
		
		set format(str) {
			switch (str) {
				case Desmovie.Formats.MP4:
				case Desmovie.Formats.WEBM:
				case Desmovie.Formats.GIF:
					this._format = str;
					break;
				default:
					console.warn('Not a valid format. Change ignored');
			}
		}
		
		get format() {
			switch (this._format) {
				case Desmovie.Formats.MP4:
					return {
						index: this._format,
						extension: 'mp4',
						mediatype: 'video/mp4'
					};
				case Desmovie.Formats.WEBM:
					return {
						index: this._format,
						extension: 'webm',
						mediatype: 'video/webm'
					};
				case Desmovie.Formats.GIF:
					return {
						index: this._format,
						extension: 'gif',
						mediatype: 'image/gif'
					};
				default:
					return null;
			}
		}
		
		set framerate(num) {
			if (num <= 0) throw new Error('framerate must be a positive non-zero number');
			
			this._framerate = num;
		}
		
		get framerate() {
			return this._framerate;
		}
		
		async collectFrames() {
			this._shortcircuit = false;
			
			const {extension, mediatype} = this.format;
			const outfile = `output.${extension}`;
			const digitName = num => `0000${num}`.slice(-5);
			const expModel = Calc.controller.getItemModel(this.ID);
			
			const stepThrough = (idx) => {
				if (this._type === 'sim') {
					Calc.controller.dispatch({
						id: this.ID,
						type: "simulation-single-step"
					})
				} else if (this._type === 'slider') {
					const sliderName = expModel.latex.match(/(.+=).+/)[1];
					Calc.setExpression({
						id: this.ID,
						latex: `${sliderName}${idx}`
					});
				}
			}
			const isFinished = i => {
				if (this._shortcircuit) return false;
				if (this._type === 'slider') {
					let end = this.options.end, step = this.options.step;
					return (step > 0? i <= end : i >= end);
				} else if (
					this._type === 'sim' &&
					this.options._type === SimulationExp.Types.FRAMEQUOTA
				) {
					// assumes start is zero
					let quota = this.options.quota;
					return i < quota;
				} else {
					// sim conditional
					console.warn('implementation pending');
					return false;
				}
			}
			
			console.log('Loading ffmpeg-core.js');
			await ffmpeg.load();
			console.log('Loading data');
			
			let start = this.options.start;
			let frameNames = [], counter = 0;
			
			let idx = (this._type === 'slider'? this.options.start : 0);
			while (isFinished(idx)) {
				stepThrough(idx);
				
				let filename = `desmos.${digitName(counter)}.png`;
				frameNames.push(filename);
				ffmpeg.FS(
					'writeFile', filename,
					await fetchFile(await this._capture.getAsyncScreenshot())
				);
				++counter;++idx;
			}
			
			let codex = Desmovie.fetchFormatFlag(
				this._format, (
					this._format === Desmovie.Formats.GIF?
					`-loop ${this.loop ? 0 : -1} -lavfi palettegen=stats_mode=single[pal],[0:v][pal]paletteuse=new=1` : ''
				)
			);
			let command = flagSpread(
				`-r ${this.framerate} -pattern_type glob -i *.png ${codex} ${outfile}`
			);
			console.log('Start transcoding');
			await ffmpeg.run(...command);
			const data = ffmpeg.FS('readFile', outfile);
			frameNames.forEach((filename) => {
				ffmpeg.FS('unlink', filename);
			});
			
			let url = URL.createObjectURL(
				new Blob([data.buffer], { type: mediatype })
			);
			download(url, 'untitled');
			ffmpeg.FS('unlink', outfile);
		}
		
		stop() {
			this._shortcircuit = true;
		}
		
		static fetchFormatFlag(format, addFlags) {
			switch (format) {
				case Desmovie.Formats.MP4:
					return '-c:v libx264 -pix_fmt yuv420p';
				case Desmovie.Formats.WEBM:
					return '-c:v libvpx-vp9 -b:v 2M';
				case Desmovie.Formats.GIF:
					return addFlags;
				default:
					throw new Error('This format is not supported.');
			}
		}
		
		static Formats = Object.freeze({
			MP4: 0,
			WEBM: 1,
			GIF: 2
		});
	}
	
	function isBoolean(val) {
		return val === false || val === true;
	}
	
	// Function to download data to a file
	function download(url, filename) {
		if (window.navigator.msSaveOrOpenBlob) { // IE10+
			window.navigator.msSaveOrOpenBlob(url, filename);
		} else { // Others
			var a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			setTimeout(function() {
				document.body.removeChild(a);
				window.URL.revokeObjectURL(url);  
			}, 0); 
		}
	}
	
	function flagSpread(command) {
		return command.trim().replaceAll(/\x20+/g, ' ').split(' ');
	}
	
	window.DescreenShot = DescreenShot;
	window.Desmovie = Desmovie;
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// User-Script Initialization
	
	// defines an object that is shared among my scripts 
	function defineScript() {
		if (window.SLM === undefined) {
			console.log(
				'scripts by\n' +
				' _____ _ _          ______                            \n' + 
				'/  ___| (_)         | ___ \\                           \n' + 
				'\\ \`--.| |_ _ __ ___ | |_/ /   _ _ __  _ __   ___ _ __ \n' + 
				' \`--. \\ | | \'_ \` _ \\|    / | | | \'_ \\| \'_ \\ / _ \\ \'__|\n' + 
				'/\\__/ / | | | | | | | |\\ \\ |_| | | | | | | |  __/ |   \n' + 
				'\\____/|_|_|_| |_| |_\\_| \\_\\__,_|_| |_|_| |_|\\___|_|   \n'
			);
			
			window.SLM = Object.assign({}, {
				messages: [],
				scripts: [GM_info.script.name],
				
				printMsgQueue: function() {
					while (this.printMessage()) { }
				},
				
				printMessage: function() {
					if (this.messages.length === 0) return false;
					let msg = this.messages.shift();
					console[msg.type](...msg.args);
					return this.messages.length !== 0;
				},
				
				pushMessage: function(type, ...msgArgs) {
					this.messages.push({
						type: type,
						args: msgArgs
					});
				}
			});
			
			Object.defineProperties(window.SLM, {
				MESSAGE_DELAY : {
					value: 500,
					writable: false,
					enumerable: true,
					configurable: true
				},
				ATTEMPTS_LIMIT : {
					value: 50,
					writable: false,
					enumerable: true,
					configurable: true
				},
				ATTEMPTS_DELAY : {
					value: 200,
					writable: false,
					enumerable: true,
					configurable: true
				}
			});
		} else {
			window.SLM.scripts.push(GM_info.script.name);
		}
	}
	
	// checks if calc and desmos are defined
	function isCalcReady() {
		if (
			window.Desmos !== undefined &&
			window.Calc !== undefined
		) {
			Calc = window.Calc;
			return true;
		} else {
			return false;
		}
	}
	
	// iife that checks if Desmos has finished loading (10 attempts)
	(function loadCheck () {
		const SLM = window.SLM;
		
		if (loadCheck.attempts === undefined) {
			loadCheck.attempts = 0;
		} else {
			loadCheck.attempts++;
		}
		
		if (!isCalcReady()) {
			if (loadCheck.attempts < SLM.ATTEMPTS_LIMIT) {
				window.setTimeout(loadCheck, SLM.ATTEMPTS_DELAY);
			} else {
				SLM.pushMessage('warn', '%s aborted loading', GM_info.script.name);
				setTimeout(() => {
					SLM.printMsgQueue();
				}, SLM.MESSAGE_DELAY);
			}
			
		} else {
			
			try {
				
				// Nothing to do here
				
				SLM.pushMessage('log', '%s loaded properly ✔️', GM_info.script.name);
			} catch (ex) {
				SLM.pushMessage('error', `${ex.name}: ${ex.message}`);
				SLM.pushMessage('warn', 'An error was encountered while loading');
			} finally {
				setTimeout(() => {
					SLM.printMsgQueue();
				}, SLM.MESSAGE_DELAY);
			}
			
		}
	}());
	
}());
