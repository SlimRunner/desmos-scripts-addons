// ==UserScript==
// @name        DesmosArtTools
// @namespace   slidav.Desmos
// @version     1.5.2
// @author      SlimRunner (David Flores)
// @description Adds a color picker to Desmos
// @grant       none
// @match       https://www.desmos.com/calculator
// @downloadURL https://github.com/SlimRunner/desmos-scripts-addons/raw/master/art-tools-script/dgc-art-tools.user.js
// @updateURL   https://github.com/SlimRunner/desmos-scripts-addons/raw/master/art-tools-script/dgc-art-tools.user.js
// ==/UserScript==

/*jshint esversion: 6 */

(function() {
	'use strict';
	var Calc;
	
	defineScript();
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// Global data structures & objects
	
	// creates an error with custom name
	class CustomError extends Error {
		/* Source
		* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
		*/
		constructor(name, ...params) {
			// Pass remaining arguments (including vendor specific ones) to parent constructor
			super(...params);

			// Maintains proper stack trace for where our error was thrown (only available on V8)
			if (Error.captureStackTrace) {
				Error.captureStackTrace(this, CustomError);
			}
				
			this.name = name;
		}
	}
	
	// Color class for the HSV color picker
	class HSVColor {
		constructor(hue, sat, value, alpha = 1) {
			this.hue = hue;
			this.saturation = sat;
			this.value = value;
			this.alpha = alpha;
		}
		
		get HSV() {
			return [this.hue, this.saturation, this.value, this.alpha];
		}
		
		get RGB() {
			return getRGBfromHSV(
				this.hue, this.saturation, this.value
			).concat(this.alpha);
		}
		
		getCSSRGBA() {
			let rgb = getRGBfromHSV(
				this.hue,
				this.saturation,
				this.value
			).map((n) => {
				return Math.round(n * 255);
			});
			
			if (this.alpha === 1) {
				return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
			}
			
			return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${this.alpha})`;
		}
		
		getHexRGBA() {
			let hexCodes = getRGBfromHSV(
				this.hue, this.saturation, this.value
			).map((n) => {
				let strOut = Math.round(n * 255).toString(16);
				if (strOut.length === 1) strOut = '0' + strOut;
				return strOut;
			});
			
			if (this.alpha < 1) {
				let strOut = Math.round(ctrPicker.alphaSlider.value * 255).toString(16);
				if (strOut.length === 1) strOut = '0' + strOut;
				hexCodes.push(strOut);
			}
			
			return '#' + hexCodes.join('');
		}
		
		setHSV(hue, sat, value, alpha = 1) {
			this.hue = hue;
			this.saturation = sat;
			this.value = value;
			this.alpha = alpha;
		}
		
		setRGB(red, green, blue, alpha = 1) {
			[
				this.hue,
				this.saturation,
				this.value,
				this.alpha = alpha
			] = getHSVfromRGB(red, green, blue);
		}
		
		static isEqual(lhs, rhs) {
			return (
				lhs.hue === rhs.hue &&
				lhs.saturation === rhs.saturation &&
				lhs.value === rhs.value &&
				lhs.alpha === rhs.alpha
			);
		}
	}
	
	// dialog result values
	const DialogResult = Object.defineProperties({}, {
		None: constProperty(0),
		OK : constProperty(1),
		Cancel : constProperty(2)
	});
	
	// type of result from color picker
	const ColorResType = Object.defineProperties({}, {
		SINGLE_COLOR : constProperty(0),
		MULTIPLE_COLORS : constProperty(1),
		TOGGLE_LIVE: constProperty(2)
	});
	
	// stores the state of the color picker
	const CPicker = Object.assign({}, {
		show: showColorWheel,
		hide: hideColorWheel,
		onChange: null,
		dispatcher: null,
		pickerImage: null,
		canvasOffset: null,
		triangle: null,
		
		markers: {
			active: null,
			hue: [],
			satv: []
		},
		
		result: {
			value: null, // HSVColor
			initValue: null, // HSVColor
			type: ColorResType.SINGLE_COLOR,
			action: DialogResult.None,
			changed: function () {
				return !(
					typeof this.value === typeof this.initValue &&
					Array.isArray(this.value) ?
					false: // implementation pending
					HSVColor.isEqual(this.value, this.initValue)
				);
			},
		}
	});
	
	// stores the state of the context menu
	const ActiveItem = Object.assign({}, {
		expression: null,
		element: null,
		menuActive: false,
		menuVisible: false,
		reset: function () {
			this.expression = null;
			this.element = null;
			this.menuActive = false;
			this.menuVisible = false;
		}
	});
	
	// radians to degrees ratio
	const RAD_TO_DEG = 180 / Math.PI;
	
	// canvas properties
	const CANV_SIZE = 256;
	const CANV_MID = CANV_SIZE / 2;
	
	// color wheel properties
	const TRIAG_RAD = CANV_SIZE * 45 / 128; // 90:256
	const WHEEL_RAD_OUT = CANV_MID; // 2:256
	const WHEEL_RAD_IN = CANV_SIZE * 53 / 128; // 106:256
	const MARK_SIZE = 6;
	
	// stores all controls used in the script
	var ctrColor;
	var ctrPicker;
	// stores all buttons of the context menu
	var buttonList;
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// GUI Management - Main
	
	// initializes the graphic interface
	function initGUI() {
		// adds a stylesheet used by the GUI into the head
		insertNodes(document.head, {
			group : [{
				tag : 'style',
				id : 'sli-script-stylesheet',
				attributes : [
					{name: 'type', value: 'text/css'}
				],
				nodeContent : `
				/* COLOR MENU */
				
				.sli-prop-menu {
					display: grid;
					grid-template-columns: repeat(3, 1fr);
					gap: 8px;
					
					position: fixed !important;
					left: 0;
					top: 0;
					z-index: 99;
					visibility: hidden;
					opacity: 0;
					transition: opacity 0.1s ease-out;
					
					padding: 8px !important;
				}
				
				.sli-menu-button {
					background: #ededed;
					padding: 5px;
					width: 38px;
					height: 38px;
				}
				
				.sli-dcg-icon-align {
					text-align: center;
					line-height: 2em;
				}
				
				.sli-dat-color-prev-back {
					display: block;
					width: 100%;
					height: 100%;
					border: 1px solid #d3d3d3;
					border-radius: 3px;
					background-color: white;
					background-size: 10px 10px;
					background-position: 0 0, 5px 5px;
					background-image:
						linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc),
						linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc);
					overflow: hidden;
				}
				
				.sli-dat-color-prev {
					display: block;
					width: 100%;
					height: 100%;
					background: black;
				}
				`
			}]
		});
		
		// adds elements for the context menu into the body
		ctrColor = insertNodes(document.body, {
			group : [{
				tag : 'div',
				varName : 'propMenu',
				id : 'expr-context-menu',
				classes : [
					'sli-prop-menu',
					'dcg-options-menu'
				],
				group : [{
					tag : 'div',
					varName : 'colorButton',
					attributes: [
						{name: 'title', value: 'Color Picker'}
					],
					classes : [
						'sli-menu-button',
						'dcg-btn-flat-gray'
					],
					group : [{
						tag : 'span',
						classes : [
							'sli-dat-color-prev-back'
						],
						group : [{
							tag : 'span',
							varName : 'colorButtonPreview',
							classes : [
								'sli-dat-color-prev'
							]
						}]
					}]
				}, {
					tag: 'div',
					varName: 'urlButton',
					attributes: [
						{name: 'title', value: 'Paste image url'}
					],
					classes: [
						'sli-menu-button',
						'dcg-btn-flat-gray',
						'sli-dcg-icon-align'
					],
					group : [{
						tag : 'i',
						classes : [
							'dcg-icon-clipboard'
						]
					}]
				}]
			}]
		});
		
		// groups all buttons from context menu in a list
		buttonList = [
			ctrColor.colorButton,
			ctrColor.urlButton
		];
		
		// executes a function when the color menu is triggered
		hookMenu(
			'.dcg-expressions-options-menu,.dcg-table-column-menu,.dcg-image-options-menu',
			seekColorContext,
			(menuElem, expItem, menuFound) => {
				// desmos context menu showed up or hid
				ActiveItem.menuVisible = menuFound;
				
				if (menuFound) {
					// capture expression and node when menu is visible
					ActiveItem.expression = expItem;
					ActiveItem.element = menuElem;
					setMenuLocation();
				}
				
				if (!ActiveItem.menuActive) {
					// hides custom menu if desmos menu is gone, but my menu is not active (e.g. being hovered or being clicked)
					showPropMenu(menuFound);
					setTimeout(() => {
						// relocate to fix misplacement with tray-scroll-patch
						setMenuLocation();
					}, 20);
				}
			}
		);
		
	}
	
	// triggers a callback whenever an expression menu in Desmos is deployed
	function hookMenu(mainQuery, scrapePredicate, callback) {
		// initializes observer
		let menuObserver = new MutationObserver( obsRec => {
			let menuElem = document.querySelector(mainQuery);
			let isFound = menuElem !== null;
			
			let expItem = {};
			
			// if an item was found then populates output object (expItem)
			if (isFound) {
				expItem = scrapePredicate();
			} // if (isFound)
			
			// calls predicate to process the output
			callback(menuElem, expItem, isFound);
			
		}); // !MutationObserver
		
		// finds the container of the contextual popups of Desmos
		let menuContainer = getParentByQuery(document.body, '.dcg-exppanel-outer');
		
		if (menuContainer !== null) {
			menuObserver.observe(menuContainer, {
				childList: true
			});
		} else {
			throw new CustomError('Fatal Error', 'Context menu observer could not be initialized');
		}
		
	}
	
	// predicate for hookMenu
	function seekColorContext() {
		const expressionQuery = '.dcg-expressionitem.dcg-depressed,.dcg-expressionitem.dcg-hovered';
		const tableQuery = '.dcg-expressionitem.dcg-expressiontable.dcg-depressed,.dcg-expressionitem.dcg-expressiontable.dcg-hovered';
		const imageQuery = '.dcg-expressionitem.dcg-expressionimage.dcg-depressed,.dcg-expressionitem.dcg-expressionimage.dcg-hovered'
		const cellQuery = '.dcg-cell.dcg-depressed,.dcg-cell.dcg-hovered';
		let expElem;
		
		if (expElem = document.querySelector(tableQuery)) {
			let eID = expElem.getAttribute('expr-id');
			// this is a table
			return {
				elem: expElem,
				type: 'table',
				id: eID,
				colIndex: seekAttribute(expElem, cellQuery, 'index'),
				index: getExprIndex(eID)
			};
		} else if (expElem = document.querySelector(imageQuery)) {
			let eID = expElem.getAttribute('expr-id');
			// this is an image
			return {
				elem: expElem,
				type: 'image',
				id: eID,
				index: getExprIndex(eID)
			};
		} else if (expElem = document.querySelector(expressionQuery)) {
			let eID = expElem.getAttribute('expr-id');
			// this is an expression
			return {
				elem: expElem,
				type: 'expression',
				id: eID,
				index: getExprIndex(eID)
			};
		} else {
			return {};
		}
	}
	
	// returns true if the expression fill opacity can be changed
	function isFillable(stExpr) {
		return stExpr.type === 'expression' && (stExpr.fill ||
			stExpr.latex.indexOf('\\operatorname{polygon}') !== -1);
	}
	
	// dynamically show of hide buttons
	function prepareMenu() {
		let stExpr = getStateExpr(ActiveItem.expression.index);
		if (
			stExpr.hasOwnProperty('colorLatex') ||
			ActiveItem.expression.type === 'image'
		) {
			ctrColor.colorButton.style.display = 'none';
		} else {
			ctrColor.colorButton.style.display = 'block';
		}
		
		if (ActiveItem.expression.type === 'image') {
			ctrColor.urlButton.style.display = 'block';
		} else {
			ctrColor.urlButton.style.display = 'none';
		}
		
		// get number of displayed childs
		let elemSize = Math.min(3, Array.from (
			ctrColor.propMenu.childNodes
		).filter(elem => elem.style.display !== 'none').length);
		
		ctrColor.propMenu.style.gridTemplateColumns = `repeat(${elemSize}, 1fr)`;
	}
	
	// shows or hides button to access custom properties
	function showPropMenu(visible) {
		if (visible) {
			prepareMenu();
			ctrColor.propMenu.style.visibility = 'visible';
			ctrColor.propMenu.style.opacity = '1';
			
			updateColorPreview();
			
			// update buttons dynamically while menu is open
			Calc.observeEvent('change', () => {
				// shows button when fill option is enabled
				prepareMenu();
				// updates color when color changes
				updateColorPreview();
			});
			
		} else {
			// clears stagnant data : will clear it before the color is assigned
			// ActiveItem.reset();
			ctrColor.propMenu.style.visibility = 'hidden';
			ctrColor.propMenu.style.opacity = '0';
			
			// stop observing changes on desmos color menu (was closed)
			Calc.unobserveEvent('change');
		}
	}
	
	// sets the location of the context menu
	function setMenuLocation() {
		let menu = ActiveItem.element.getBoundingClientRect();
		
		let x = menu.left + menu.width + 8;
		let y = menu.top;
		
		ctrColor.propMenu.style.left = `${x}px`;
		ctrColor.propMenu.style.top = `${y}px`;
	}
	
	// sets the color preview on contex menu button
	function updateColorPreview() {
		if (ctrColor.colorButton.style.display === 'none') return;
		let [r, g, b, al = 1] = getRGBpack(
			getCurrentColor()
		).map((n, i) => {
			if (i !== 3) return Math.round(n * 255);
			else return n;
		});
		ctrColor.colorButtonPreview.style.background = (
			`linear-gradient(-45deg,rgba(${r},${g},${b}) 49%,rgba(${r},${g},${b},${al}) 51%)`
		);
	}
	
	// returns color of expression with the menu active
	function getCurrentColor() {
		let expr = getStateExpr(ActiveItem.expression.index);
		
		if (expr.type === 'expression') {
			return expr.color;
			
		} else if (expr.type === 'table') {
			return expr.columns[ActiveItem.expression.colIndex].color;
			
		}
		
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// GUI Management - Custom Color Picker
	
	// initializes the color picker interface
	function initColorPicker() {
		// insert css styles into existing stylesheet
		appendTextToNode(
			'sli-script-stylesheet',
			`
			/* COLOR PICKER DIALOG */
			
			/***********************************************************************/
			/* Styles of full-page shade */
			.sli-page-shade {
				position: fixed;
				left: 0;
				top: 0;
				width: 100%;
				height: 100%;
				z-index: 99;
				padding: 10px;
				background: rgba(0,0,0,0.4);
				visibility: hidden;
				opacity: 0;
				transition: visibility 0s linear 0.4s, opacity 0.4s cubic-bezier(.22,.61,.36,1);
			}
			
			.sli-page-shade-show {
				visibility: visible;
				opacity: 1;
				transition: visibility 0s, opacity 0.4s cubic-bezier(.22,.61,.36,1);
			}
			
			/***********************************************************************/
			/* Styles of dialog */
			.sli-dialog-grid {
				display: grid;
				grid-template-columns: 50% repeat(2, 1fr 2fr);
				grid-template-rows: repeat(11, 1fr);
				padding: 8px;
			}
			
			.sli-button-picker-divisor {
				width: 100%;
				height: 100%;
				display: grid;
				grid-template-columns: 1fr 1fr 2fr 2fr;
				grid-template-rows: 1fr;
			}
			
			.sli-dialog-style {
				color: whitesmoke;
				font-family: Arial, Helvetica, sans-serif;
				font-size: 12pt;
				width: 640px;
				height: 480px;
				background: linear-gradient(#666, #555);
				position: absolute;
				left: 50%;
				top: 50%;
				transform: translate(-50%, -50%);
				box-shadow: 2.5px 4.3px 20px 2px rgba(0,0,0,0.5);
				border: 4px solid #1c9969;
				border-radius: 12px;
			}
			
			/***********************************************************************/
			/* Styles of grid items */
			.sli-item-picker {
				grid-column: 1;
				grid-row: 1 / 9;
			}
			
			.sli-item-slider {
				grid-column: 1;
				grid-row: 8 / 10;
			}
			
			.sli-item-hexInput-label {
				grid-column: 2;
				grid-row: 2;
			}
			
			.sli-item-hueInput-label {
				grid-column: 2;
				grid-row: 3;
			}
			
			.sli-item-satInput-label {
				grid-column: 2;
				grid-row: 4;
			}
			
			.sli-item-valInput-label {
				grid-column: 2;
				grid-row: 5;
			}
			
			.sli-item-alphaInput-label {
				grid-column: 2;
				grid-row: 6;
			}
			
			.sli-item-hexInput {
				grid-column: 3;
				grid-row: 2;
			}
			
			.sli-item-hueInput {
				grid-column: 3;
				grid-row: 3;
			}
			
			.sli-item-satInput {
				grid-column: 3;
				grid-row: 4;
			}
			
			.sli-item-valInput {
				grid-column: 3;
				grid-row: 5;
			}
			
			.sli-item-alphaInput {
				grid-column: 3;
				grid-row: 6;
			}
			
			.sli-item-buttons-div {
				grid-column: 2 / 6;
				grid-row: 11;
			}
			
			.sli-item-dialOk {
				grid-column: 3;
				grid-row: 1;
			}
			
			.sli-item-dialCancel {
				grid-column: 4;
				grid-row: 1;
			}
			
			/***********************************************************************/
			/* Styles of canvas */
			.sli-picker-canvas {
				outline: none;
				background: #222;
				border-radius: 50%;
				margin: auto;
				border: 4px dashed #444;
				transition: 0.2s;
			}
			
			.sli-picker-canvas:hover,
			.sli-picker-canvas:focus {
				border: 4px dashed #666;
				background: #333;
			}
			
			/***********************************************************************/
			/* Styles Slider */
			
			.sli-cpk-slider {
				-webkit-appearance: none;
				width: 256px;
				height: 8px;
				border-radius: 3px;
				background: #333;
				outline: none;
				opacity: 0.7;
				-webkit-transition: 0.2s;
				transition: opacity 0.2s;
				border: 1px solid #fff6;
				box-shadow: inset 0 0 4px 0 #000a;
				margin: auto;
			}
			
			.sli-cpk-slider:hover,
			.sli-cpk-slider:focus,
			.sli-cpk-slider:focus:active {
				background: #444;
				border: 1px solid #fff6;
			}
			
			.sli-cpk-slider::-webkit-slider-thumb {
				-webkit-appearance: none;
				appearance: none;
				width: 8px;
				height: 20px;
				border-radius: 5px;
				background: #888;
				cursor: pointer;
				border: 1px solid #fffc;
				transition: 0.2s;
			}
			
			.sli-cpk-slider::-webkit-slider-thumb:hover,
			.sli-cpk-slider:focus::-webkit-slider-thumb, {
				background: #17ad6c;
			}
			
			.sli-cpk-slider:focus:active::-webkit-slider-thumb {
				border: 1px solid #fff;
				background: #1fe18d;
			}
			
			.sli-cpk-slider::-moz-range-thumb {
				width: 8px;
				height: 20px;
				border-radius: 5px;
				background: #888;
				cursor: pointer;
				border: 1px solid #fffc;
				transition: 0.2s;
			}
			
			.sli-cpk-slider::-moz-range-thumb:hover,
			.sli-cpk-slider:focus::-moz-range-thumb {
				background: #17ad6c;
			}
			
			.sli-cpk-slider:focus:active::-moz-range-thumb {
				border: 1px solid #fff;
				background: #1fe18d;
			}
			
			/***********************************************************************/
			/* Styles of Labels and Icons */
			.sli-page-shade label {
				color: #DDD;
				margin: auto 4px auto auto;
				text-shadow: 1px 2px 2px rgba(0,0,0,0.5);
			}
			
			/***********************************************************************/
			/* Styles textbox */
			.sli-text-box-color-appearance {
				font-family: inherit;
				font-weight: bold;
				letter-spacing: 2px;
				font-variant-numeric: tabular-nums;
				text-align: right;
				width: 5em;
				margin: 8px auto 8px 8px;
			}
			
			.sli-text-box-hex-appearance {
				font-family: "Lucida Console", Monaco, monospace;
				text-align: left;
				width: 7em;
				margin: 8px auto 8px 8px;
			}
			
			/*normal*/
			.sli-textbox-style-darkShade {
				outline: none;
				color: gainsboro;
				background-color: #333;
				border: 1px solid #fff6;
				box-shadow:
					inset 0 0 4px 0 #000a;
				border-radius: 3px;
				padding: 0.4em 0.5em 0.4em 0.5em;
				transition: 0.2s;
			}
			
			/*hover*/
			.sli-textbox-style-darkShade:hover {
				border: 1px solid #7fc;
				box-shadow:
					0 0 0 1px #7fc2,
					inset 0 0 2px 0 #fffa;
			}
			
			/*focus*/
			.sli-textbox-style-darkShade:focus {
				border: 1px solid #7fc;
				box-shadow:
					0 0 0 1px #7fc2,
					inset 0 0 2px 0 #fffa;
			}
			
			/*focus and hover*/
			.sli-textbox-style-darkShade:focus:hover {
				background-color: #3a3a3a;
				border: 1px solid #7fc;
				box-shadow:
					0 0 0 1px #7fc2,
					inset 0 0 2px 0 #fffa;
			}
			
			/***********************************************************************/
			/* Button Styles */
			/*resizes the button elements to a comfortable size*/
			.button-size {
				outline: none;
				font-family: inherit;
				font-size: 11pt;
				margin-top: 8px;
				margin-bottom: 8px;
				margin-left: auto;
				margin-right: auto;
				width: 6em;/*200px;*/
				height: 2em;/*25px;*/
			}
			
			/* GREEN BUTTON */
			.sli-button-style-shadowGreen {
				font-family: inherit;
				border: none;
				background-color: #888;
				background-size: 100% 100%;
				border-radius: 5px;
				border: 1px solid #333;
				transition: 0.2s;
			}
			
			/*button mouse over*/
			.sli-button-style-shadowGreen:hover {
				border: 1px solid #055633;
				background-color: #17ad6c;
				box-shadow: 0 4px 8px -1px #0003;
			}
			
			/*button focus*/
			.sli-button-style-shadowGreen:focus {
				border: 1px solid #055633;
				background-color: #17ad6c;
				box-shadow: 0 4px 8px -1px #0003;
			}
			
			/*button focus and press*/
			.sli-button-style-shadowGreen:focus:active {
				border: 1px solid #444;
				padding-top: 1px;
				background-color: #0c7f4d;
				transition: 0.1s;
				box-shadow: inset 0 1px 3px 0px #0006;
			}
			
			/*prevent firefox from moving the text on press*/
			.sli-button-style-shadowGreen:active{
				padding: 0px;
			}
			
			/* RED BUTTON */
			.sli-button-style-shadowRed {
				font-family: inherit;
				border: none;
				background-color: #888;
				background-size: 100% 100%;
				border-radius: 5px;
				border: 1px solid #333;
				transition: 0.2s;
			}
			
			/*button mouse over*/
			.sli-button-style-shadowRed:hover {
				border: 1px solid #6b2525;
				background-color: #d54646;
				box-shadow: 0 4px 8px -1px #0003;
			}
			
			/*button focus*/
			.sli-button-style-shadowRed:focus {
				border: 1px solid #6b2525;
				background-color: #d54646;
				box-shadow: 0 4px 8px -1px #0003;
			}
			
			/*button focus and press*/
			.sli-button-style-shadowRed:focus:active {
				border: 1px solid #444;
				padding-top: 1px;
				background-color: #ba2b2b;
				transition: 0.1s;
				box-shadow: inset 0 1px 3px 0px #0006;
			}
			
			/*prevent firefox from moving the text on press*/
			.sli-button-style-shadowRed:active{
				padding: 0px;
			}`
		);
		
		// adds elements for the color picker into the body
		ctrPicker = insertNodes(document.body, {
			group: [{
				tag: 'div',
				varName: 'background',
				attributes: [
					{name: 'tabindex', value: '0'}
				],
				classes: [
					'sli-page-shade',
					'dcg-no-touchtracking'
				],
				group: [{
					tag: 'div',
					varName: 'dialFrame',
					attributes: [
						{name: 'tabindex', value: '1'}
					],
					classes: [
						'sli-dialog-style',
						'sli-dialog-grid',
						'dcg-no-touchtracking'
					],
					group: [{
						tag: 'canvas',
						varName: 'colorWheel',
						nodeContent: "This browser doesn't support HTML5",
						attributes: [
							{name: 'width', value: CANV_SIZE + 'px'},
							{name: 'height', value: CANV_SIZE + 'px'},
							{name: 'tabindex', value: '2'}
						],
						classes: [
							'sli-picker-canvas',
							'sli-item-picker',
							'dcg-no-touchtracking'
						]
					}, {
						tag: 'input',
						varName: 'alphaSlider',
						attributes: [
							{name: 'type', value: 'range'},
							{name: 'title', value: 'transparency'},
							{name: 'min', value: '0'},
							{name: 'max', value: '1'},
							{name: 'step', value: '0.001'},
							{name: 'value', value: '1'},
							{name: 'tabindex', value: '3'}
						],
						classes: [
							'sli-cpk-slider',
							'sli-item-slider'
						]
					}, {
						tag : 'label',
						nodeContent: 'Hex:',
						attributes: [
							{name: 'for', value : 'hexInput-hsl-picker'}
						],
						classes: [
							'sli-item-hexInput-label'
						]
					}, {
						tag : 'label',
						nodeContent: 'H:',
						attributes: [
							{name: 'for', value : 'hueInput-hsl-picker'}
						],
						classes: [
							'sli-item-hueInput-label'
						]
					}, {
						tag : 'label',
						nodeContent: 'S:',
						attributes: [
							{name: 'for', value : 'satInput-hsl-picker'}
						],
						classes: [
							'sli-item-satInput-label'
						]
					}, {
						tag : 'label',
						nodeContent: 'V:',
						attributes: [
							{name: 'for', value : 'valInput-hsl-picker'}
						],
						classes: [
							'sli-item-valInput-label'
						]
					}, {
						tag : 'label',
						nodeContent: 'Alpha:',
						attributes: [
							{name: 'for', value : 'alphaInput-hsl-picker'}
						],
						classes: [
							'sli-item-alphaInput-label'
						]
					}, {
						tag: 'input',
						varName: 'hexInput',
						id: 'hexInput-hsl-picker',
						attributes: [
							{name: 'type', value: 'text'},
							{name: 'tabindex', value: '4'},
							{name: 'maxlength', value: '9'}
						],
						classes: [
							'sli-text-box-hex-appearance',
							'sli-textbox-style-darkShade',
							'sli-item-hexInput'
						]
					}, {
						tag: 'input',
						varName: 'hueInput',
						id: 'hueInput-hsl-picker',
						attributes: [
							{name: 'type', value: 'text'},
							{name: 'tabindex', value: '5'},
							{name: 'maxlength', value: '5'}
						],
						classes: [
							'sli-text-box-color-appearance',
							'sli-textbox-style-darkShade',
							'sli-item-hueInput'
						]
					}, {
						tag: 'input',
						varName: 'satInput',
						id: 'satInput-hsl-picker',
						attributes: [
							{name: 'type', value: 'text'},
							{name: 'tabindex', value: '6'},
							{name: 'maxlength', value: '3'}
						],
						classes: [
							'sli-text-box-color-appearance',
							'sli-textbox-style-darkShade',
							'sli-item-satInput'
						]
					}, {
						tag: 'input',
						varName: 'valInput',
						id: 'valInput-hsl-picker',
						attributes: [
							{name: 'type', value: 'text'},
							{name: 'tabindex', value: '7'},
							{name: 'maxlength', value: '3'}
						],
						classes: [
							'sli-text-box-color-appearance',
							'sli-textbox-style-darkShade',
							'sli-item-valInput'
						]
					}, {
						tag: 'input',
						varName: 'alphaInput',
						id: 'alphaInput-hsl-picker',
						attributes: [
							{name: 'type', value: 'text'},
							{name: 'tabindex', value: '8'},
							{name: 'maxlength', value: '3'}
						],
						classes: [
							'sli-text-box-color-appearance',
							'sli-textbox-style-darkShade',
							'sli-item-alphaInput'
						]
					}, {
						tag: 'div',
						classes: [
							'sli-button-picker-divisor',
							'sli-item-buttons-div'
						],
						group: [{
							tag: 'button',
							varName: 'dialOk',
							nodeContent: '✔️',
							attributes: [
								{name: 'tabindex', value: '9'}
							],
							classes: [
								'button-size',
								'sli-button-style-shadowGreen',
								'sli-item-dialOk'
							]
						}, {
							tag: 'button',
							varName: 'dialCancel',
							nodeContent: '❌',
							attributes: [
								{name: 'tabindex', value: '10'}
							],
							classes: [
								'button-size',
								'sli-button-style-shadowRed',
								'sli-item-dialCancel'
							]
						}]
					}]
				}]
			}]
		});
		
		// get canvas context
		let ctx = ctrPicker.colorWheel.getContext("2d");
		// get canvas size
		let ctxBBox = {
			width: ctrPicker.colorWheel.clientWidth,
			height: ctrPicker.colorWheel.clientHeight
		};
		// get border offset of canvas
		CPicker.canvasOffset = {
			x: ctrPicker.colorWheel.clientLeft,
			y: ctrPicker.colorWheel.clientTop
		};
		// create an empty image for canvas
		CPicker.pickerImage = ctx.createImageData(
			ctxBBox.width, ctxBBox.height
		);
		// draw rainbow ring on canvas image
		getRainbowRing(
			CPicker.pickerImage.data,
			Math.floor(ctxBBox.width)
		);
		
		// adds custom event (to the global object?)
		CPicker.onChange = new CustomEvent('pickerChange', {detail: CPicker.result});
	}
	
	// CPicker method definition that shows the color picker
	function showColorWheel(hsvPack, dispatcher) {
		initMarkers();
		CPicker.dispatcher = dispatcher;
		CPicker.result.value = new HSVColor(...hsvPack);
		CPicker.result.initValue = new HSVColor(...hsvPack);
		
		ctrPicker.alphaSlider.value = CPicker.result.value.alpha;
		updateAlphaInput();
		setHueMarkerByAngle(0, CPicker.result.value.hue);
		CPicker.triangle = updateColorWheel(CPicker.markers.hue[0].angle);
		setSatValMarkerByNumber(0, CPicker.result.value.saturation, CPicker.result.value.value, CPicker.triangle);
		drawMarkers();
		updateTextInputs();
		
		ctrPicker.background.classList.add('sli-page-shade-show');
		
		// focus the color wheel when loading in
		setTimeout(()=>ctrPicker.colorWheel.focus(), 50);
		// for some reason it cannot be:
		// ctrPicker.colorWheel.focus();
	}
	
	// CPicker method definition that hides the color picker
	function hideColorWheel() {
		ctrPicker.background.classList.remove('sli-page-shade-show');
		
		CPicker.result.value.setHSV(
			CPicker.markers.hue[0].angle,
			CPicker.markers.satv[0].sat,
			CPicker.markers.satv[0].val,
			ctrPicker.alphaSlider.value
		);
		CPicker.dispatcher.dispatchEvent(CPicker.onChange);
	}
	
	// updates the color text inputs
	function updateTextInputs() {
		let hsvCol = new HSVColor (
			CPicker.markers.hue[0].angle,
			CPicker.markers.satv[0].sat,
			CPicker.markers.satv[0].val,
			ctrPicker.alphaSlider.value
		);
		
		ctrPicker.hexInput.value = hsvCol.getHexRGBA();
		ctrPicker.hueInput.value = getCoterminalAngle(hsvCol.hue).toFixed();
		ctrPicker.satInput.value = (hsvCol.saturation * 100).toFixed();
		ctrPicker.valInput.value = (hsvCol.value * 100).toFixed();
	}
	
	// updates the alpha text input
	function updateAlphaInput() {
		let hsvCol = new HSVColor (
			CPicker.markers.hue[0].angle,
			CPicker.markers.satv[0].sat,
			CPicker.markers.satv[0].val,
			ctrPicker.alphaSlider.value
		);
		
		ctrPicker.hexInput.value = hsvCol.getHexRGBA();
		ctrPicker.alphaInput.value = (
			ctrPicker.alphaSlider.value * 100
		).toFixed();
	}
	
	// updates color and alpha inputs
	function updateHexInput() {
		let hsvCol = new HSVColor (
			CPicker.markers.hue[0].angle,
			CPicker.markers.satv[0].sat,
			CPicker.markers.satv[0].val,
			ctrPicker.alphaSlider.value
		);
		
		ctrPicker.hexInput.value = hsvCol.getHexRGBA();
	}
	
	// renders the color wheel onto the canvas
	function updateColorWheel(angle) {
		let ctx = ctrPicker.colorWheel.getContext("2d");
		
		// draws image data onto the canvas
		ctx.putImageData(CPicker.pickerImage, 0, 0);
		
		let shadowPat = ctx.createRadialGradient(
			CANV_MID,			// from x
			CANV_MID,			// from y
			0,						// from radius
			CANV_MID,			// to x
			CANV_MID,			// to y
			WHEEL_RAD_IN	// to radius
		);
		shadowPat.addColorStop(0, '#444');
		shadowPat.addColorStop(0.9, '#333');
		shadowPat.addColorStop(1, '#111');
		ctx.fillStyle = shadowPat;
		
		ctx.beginPath();
		ctx.arc(
			CANV_MID,			// center x
			CANV_MID,			// center y
			WHEEL_RAD_IN,	// arc radius
			0,						// from angle
			Math.PI*2			// to angle
		);
		ctx.closePath();
		ctx.fill();
		
		let triagColor = getRGBfromHSV(
			angle, 1, 1
		).map(
			item => item * 255
		);
		
		let triData = drawTriangle(ctx, angle / RAD_TO_DEG, triagColor);
		
		return triData;
	}
	
	// generates data image of a chromatic circle
	function getRainbowRing(img, wdt) {
		let x, y;
		let pix;
		
		for (let i = 0; i < img.length; i += 4) {
			/*jshint bitwise: false */
			x = (i/4) % wdt - CANV_MID;
			// pipe used to convert operation to integer
			y = ((i/4) / wdt|0) - CANV_MID;
			/*jshint bitwise: true */
			
			pix = getRGBfromHSV(
				Math.atan2(-y, x)*RAD_TO_DEG, 1, 1
			).map(
				item => item * 255
			);
			
			img[i] = pix[0];
			img[i + 1] = pix[1];
			img[i + 2] = pix[2];
			img[i + 3] = 255;
		} // !for
	}
	
	// draws SV triangle to context and returns vertex data of triangle
	function drawTriangle(ctx, angle, color) {
		let triAngles = [
			angle,
			2.0943951023931953 + angle,
			4.1887902047863905 + angle
		];
		let midAngles = [
			1.0471975511965976 + angle,
			3.141592653589793 + angle,
			5.235987755982988 + angle
		];
		let arrowDisp = {
			x: 0.1 * Math.cos(angle),
			y: 0.1 * -Math.sin(angle)
		};
		let colSolid = `rgba(${color[0]},${color[1]},${color[2]},1)`;
		let triangle = [0, 0, 0], midTri = [0, 0, 0];
		
		for (var i = 0; i < triangle.length; ++i) {
			
			triangle[i] = {
				x: Math.cos(triAngles[i]),
				y: -Math.sin(triAngles[i])
			};
			
			midTri[i] = {
				x: 0.5 * Math.cos(midAngles[i]),
				y: 0.5 * -Math.sin(midAngles[i])
			};
			
		}
		
		let arrow = [1, 0, 2].map((idx) => {
			return {
				x: 0.9 * triangle[0].x + 0.1 * triangle[idx].x + arrowDisp.x,
				y: 0.9 * triangle[0].y + 0.1 * triangle[idx].y + arrowDisp.y
			};
		});
		
		ctx.save();
		
		ctx.transform(
			TRIAG_RAD,	// x-scale
			0,					// x-skew
			0,					// y-skew
			TRIAG_RAD,	// y-scale
			CANV_MID,		// x-trans
			CANV_MID		// y-trans
		);
		
		// gradient from input color to black
		let colorGrad = ctx.createLinearGradient(
			triangle[0].x,	// from x
			triangle[0].y,	// from y
			midTri[1].x,		// to x
			midTri[1].y			// to y
		);
		colorGrad.addColorStop(0, colSolid);
		colorGrad.addColorStop(1, 'black');
		
		// gradient from black to white
		let blackGrad = ctx.createLinearGradient(
			midTri[0].x,		// from x
			midTri[0].y,		// from y
			triangle[2].x,	// to x
			triangle[2].y		// to y
		);
		blackGrad.addColorStop(0, 'black');
		blackGrad.addColorStop(1, 'white');
		
		pathTriangle(ctx, arrow, false);
		ctx.lineCap = 'round';
		ctx.lineWidth = 3 / TRIAG_RAD;
		ctx.strokeStyle = colSolid;
		ctx.stroke();
		
		pathTriangle(ctx, triangle);
		ctx.fillStyle = blackGrad;
		ctx.fill();
		ctx.globalCompositeOperation = 'lighter';
		ctx.fillStyle = colorGrad;
		ctx.fill();
		
		ctx.restore();
		
		return triangle.map(n => {
			return {
				x: n.x * TRIAG_RAD + CANV_MID,
				y: n.y * TRIAG_RAD + CANV_MID
			};
		});
	}
	
	// puts in the context the path of three given vertices
	function pathTriangle(ctx, verts, close = true) {
		ctx.beginPath();
		ctx.moveTo(verts[0].x, verts[0].y);
		ctx.lineTo(verts[1].x, verts[1].y);
		ctx.lineTo(verts[2].x, verts[2].y);
		if (close) ctx.closePath();
	}
	
	// initialize color wheel markers
	function initMarkers() {
		CPicker.markers.hue = [{
			x: 0,
			y: 0,
			angle: 0
		}];
		CPicker.markers.satv = [{
			x: 0,
			y: 0,
			sat: 0,
			val: 0
		}];
		CPicker.markers.active = {
			type: 'hue', id: 0
		};
	}
	
	// draws all markers in the picker
	function drawMarkers() {
		let ctx = ctrPicker.colorWheel.getContext('2d');
		
		// alias
		const MRK = CPicker.markers;
		const mainHue = MRK.hue[0].angle;
		
		ctx.save();
		
		MRK.hue.forEach((item) => {
			ctx.beginPath();
			ctx.arc(item.x, item.y, MARK_SIZE, 0, 6.283185307179586);
			ctx.fillStyle = getCSS_hsl(item.angle, 1, 0.5);
			ctx.fill();
			ctx.lineWidth = 2.1; ctx.strokeStyle = 'white';
			ctx.stroke();
			ctx.lineWidth = 1.9; ctx.strokeStyle = 'black';
			ctx.stroke();
		});
		
		MRK.satv.forEach((item) => {
			ctx.beginPath();
			ctx.arc(item.x, item.y, MARK_SIZE, 0, 6.283185307179586);
			ctx.fillStyle = getCSS_hsl(
				...getHSLfromHSV(mainHue, item.sat, item.val)
			);
			ctx.fill();
			ctx.lineWidth = 2.1; ctx.strokeStyle = 'black';
			ctx.stroke();
			ctx.lineWidth = 1.9; ctx.strokeStyle = 'white';
			ctx.stroke();
		});
		ctx.restore();
	}
	
	// selects the appropriate marker based on location
	function selectMarker(loc) {
		let idOut;
		idOut = CPicker.markers.hue.findIndex(item => {
			return distance(loc, item) < MARK_SIZE;
		});
		if (idOut > -1) {
			return {
				type: 'hue', id: idOut
			};
		}
		
		idOut = CPicker.markers.satv.findIndex(item => {
			return distance(loc, item) < MARK_SIZE;
		});
		if (idOut > -1) {
			return {
				type: 'satv', id: idOut
			};
		}
		
		return null;
	}
	
	// sets the hue marker using a location provided (e.g. mouse)
	function setHueMarkerByMse(index, newLoc) {
		let angle = Math.atan2(-newLoc.y + CANV_MID, newLoc.x - CANV_MID);
		CPicker.markers.hue[index].angle = angle * RAD_TO_DEG;
		let radius = (WHEEL_RAD_OUT + WHEEL_RAD_IN) / 2;
		CPicker.markers.hue[index].x = radius * Math.cos(angle) + CANV_MID;
		CPicker.markers.hue[index].y = -radius * Math.sin(angle) + CANV_MID;
	}
	
	// sets the hue marker using an angle
	function setHueMarkerByAngle(index, angle) {
		CPicker.markers.hue[index].angle = angle;
		angle /= RAD_TO_DEG;
		let radius = (WHEEL_RAD_OUT + WHEEL_RAD_IN) / 2;
		CPicker.markers.hue[index].x = radius * Math.cos(angle) + CANV_MID;
		CPicker.markers.hue[index].y = -radius * Math.sin(angle) + CANV_MID;
	}
	
	// sets the saturation and value markers using a location provided
	function setSatValMarkerByMse(index, newLoc, triVtx) {
		// get confined location [maybe not]
		// proxy prevents from overriding objects returned by function
		let proxyLoc = getConfinedProbe(newLoc, triVtx);
		let confLoc = {
			x: proxyLoc.x,
			y: proxyLoc.y
		};
		
		CPicker.markers.satv[index].x = confLoc.x;
		CPicker.markers.satv[index].y = confLoc.y;
		confLoc.x -= CANV_MID;
		confLoc.y -= CANV_MID;
		
		/*
		Computes the distance between the B corner of the triangle and the distance
		the bisector of B would travel to reach the mouse with its tangent attached
		to its head (mouse-distance).
		*/
		CPicker.markers.satv[index].val = distance(
			confLoc,
			normalProjection({
				x: confLoc.x,
				y: confLoc.y
			}, {
				x: triVtx[1].x - CANV_MID,
				y: triVtx[1].y - CANV_MID
			})
		) / (TRIAG_RAD * 1.5);
		
		/*
		Computes ratio between the slice tangent to the head of bisector of B at
		mouse-distance and the side length of triangle.
		*/
		let val = CPicker.markers.satv[index].val;
		let satA = vecLerp(triVtx[1], triVtx[0], val);
		let satC = vecLerp(triVtx[1], triVtx[2], val);
		let sat = distance(proxyLoc, satC) / distance(satA, satC);
		CPicker.markers.satv[index].sat = isFinite(sat) ? sat : 0;
	}
	
	// sets the saturation and value markers using values
	function setSatValMarkerByNumber(index, sat, val, triVtx) {
		/*
		calculates the distance between the B and the farthest edge to compute the
		value then uses those two points linearly interpolate the saturation.
		*/
		let satA = vecLerp(triVtx[1], triVtx[0], val);
		let satC = vecLerp(triVtx[1], triVtx[2], val);
		let markerLoc = vecLerp(satC, satA, sat);
		
		CPicker.markers.satv[index].sat = sat;
		CPicker.markers.satv[index].val = val;
		CPicker.markers.satv[index].x = markerLoc.x;
		CPicker.markers.satv[index].y = markerLoc.y;
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// EVENT HANDLERS
	
	// adds event listeners for the context menu
	function loadEvents() {
		// hides button when menu is gone and the mouse left the button client area
		bindListenerToNodes(buttonList, 'mouseleave', () => {
			if (!ActiveItem.menuVisible) {
				ActiveItem.menuActive = false;
				showPropMenu(false);
			}
		});
		
		// changes button state to active so that button doesn't go away with menu
		bindListenerToNodes(buttonList, 'mousedown', () => {
			ActiveItem.menuActive = true;
		});
		
		// performs click changes button state to false and hides button
		bindListenerToNodes(buttonList, 'click', () => {
			ActiveItem.menuActive = false;
			showPropMenu(false);
		});
		
		// event that triggers when user clicks url button
		ctrColor.urlButton.addEventListener('click', (e) => {
			let urltext = window.prompt('Enter an image URL:');
			let state = Calc.getState();
			let aliasList = state.expressions.list;
			let idx = ActiveItem.expression.index;
			if (urltext !== '' && urltext != null) {
				getMeta(urltext, (e) => {
					const MAX_SIZE = 10;
					let w = e.target.width, h = e.target.height;
					let iw = MAX_SIZE, ih = MAX_SIZE;
					if (w > h) { ih = iw * h / w; }
					else { iw = ih * w / h; }
					aliasList[idx].image_url = urltext;
					aliasList[idx].width = iw.toString();
					aliasList[idx].height = ih.toString();
					Calc.setState(state, {allowUndo: true});
				});
			}
		});
		
		// event that triggers when user clicks color button
		ctrColor.colorButton.addEventListener('click', (e) => {
			CPicker.show(
				getHSVpack(getCurrentColor()),
				ctrColor.colorButton
			);
		});
		
		// event that triggers when user selects a color from color picker
		ctrColor.colorButton.addEventListener('pickerChange', (e) => {
			if (
				e.detail.action === DialogResult.OK &&
				e.detail.changed()
			) {
				let color = e.detail.value.getCSSRGBA();
				setExprColor(ActiveItem.expression, color);
			}
		});
		
	}
	
	// adds events listeners of the color picker
	function loadColorPickerListeners() {
		const RGX_HEX_KEY = /^[0-9a-f]$|^#$/i;
		const RGX_NUM_KEY = /^\d$/;
		const RGX_NAMED_KEY = /.{2,}/i;
		
		// when true prevents the dialog from closing
		let exitClick = false;
		
		// Release click on gray area
		ctrPicker.background.addEventListener('mousedown', (e) => {
			if (e.currentTarget.isSameNode(e.target)) {
				exitClick = true;
			} else {
				exitClick = false;
			}
		});
		
		// Release click on gray area
		ctrPicker.background.addEventListener('mouseup', (e) => {
			if (e.currentTarget.isSameNode(e.target) && exitClick) {
				CPicker.result.action = DialogResult.OK;
				CPicker.hide();
			} else {
				// nothing to do (DO NOT FOCUS)
			}
		});
		
		// prevent keyboard shortcuts from reaching Desmos GUI
		ctrPicker.background.addEventListener('keydown', (e) => {
			let keyIn = e.key.toLowerCase();
			
			switch (true) {
				case keyIn === 'enter':
					CPicker.result.action = DialogResult.OK;
					CPicker.hide();
					break;
				case keyIn === 'escape':
					CPicker.result.action = DialogResult.Cancel;
					CPicker.hide();
					break;
				default:
					// Nothing to do
			}
			
			e.stopPropagation();
			return false;
		});
		
		// prevent keyboard shortcuts from reaching Desmos GUI
		ctrPicker.background.addEventListener('keyup', (e) => {
			e.stopPropagation();
			return false;
		});
		
		// prevent the focus from going rogue
		ctrPicker.background.addEventListener('focus', (e) => {
			ctrPicker.colorWheel.focus();
		});
		
		// triggers when the alpha slider has been changed
		ctrPicker.alphaSlider.addEventListener('change', updateAlphaInput);
		
		// triggers each time the alpha slider is changed
		ctrPicker.alphaSlider.addEventListener('input', updateAlphaInput);
		
		// Ok dialog button
		ctrPicker.dialOk.addEventListener('click', () => {
			CPicker.result.action = DialogResult.OK;
			CPicker.hide();
		});
		
		// Cancel dialog button
		ctrPicker.dialCancel.addEventListener('click', () => {
			CPicker.result.action = DialogResult.Cancel;
			CPicker.hide();
		});
		
		// tidies up format of the hex color
		ctrPicker.hexInput.addEventListener('change', (e) => {
			updateHexInput();
		});
		
		// tidies up format of the hex color
		ctrPicker.hueInput.addEventListener('change', (e) => {
			const RGX_5_DIGITS = /^\d{1,5}$/i;
			let hueText = ctrPicker.hueInput.value.trim();
			let h;
			
			if (RGX_5_DIGITS.test(hueText)) {
				h = parseInt(hueText);
			} else {
				h = CPicker.marker.hue[0].angle;
			}
			
			ctrPicker.hueInput.value = getCoterminalAngle(h).toFixed();
		});
		
		// tidies up format of the hex color
		bindListenerToNodes([
			ctrPicker.satInput,
			ctrPicker.valInput,
			ctrPicker.alphaInput
		], 'change', (e) => {
			const RGX_3_DIGITS = /^\d{1,3}$/i;
			let thisText = e.target.value.trim();
			let thisVal;
			
			if (RGX_3_DIGITS.test(thisText)) {
				thisVal = minmax(parseInt(thisText), 0, 100);
			} else {
				switch (true) {
					case e.target.isSameNode(ctrPicker.satInput):
						thisVal = CPicker.markers.satv[0].sat * 100;
						break;
					case e.target.isSameNode(ctrPicker.valInput):
						thisVal = CPicker.markers.satv[0].val * 100;
						break;
					case e.target.isSameNode(ctrPicker.alphaInput):
						thisVal = ctrPicker.alphaSlider.value * 100;
						break;
					default:
						thisVal = 0;
				}
			}
			
			e.target.value = (thisVal).toFixed();
		});
		
		// updates all color values with the hex color code
		ctrPicker.hexInput.addEventListener('input', (e) => {
			const RGX_HEX_STRING = /^#?(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
			let hexText = ctrPicker.hexInput.value.trim();
			
			if (RGX_HEX_STRING.test(hexText)) {
				hexText = (hexText.indexOf('#') !== -1? '' : '#' ) + hexText;
				
				let [r, g, b, a = 1] = parseCSSHex(hexText, true);
				let [h, s, v] = getHSVfromRGB(r, g, b);
				
				ctrPicker.alphaSlider.value = a;
				setHueMarkerByAngle(0, h);
				CPicker.triangle = updateColorWheel(CPicker.markers.hue[0].angle);
				setSatValMarkerByNumber(0, s, v, CPicker.triangle);
				drawMarkers();
				
				ctrPicker.hueInput.value = getCoterminalAngle(h, 360).toFixed();
				ctrPicker.satInput.value = (s * 100).toFixed();
				ctrPicker.valInput.value = (v * 100).toFixed();
				ctrPicker.alphaInput.value = (a * 100).toFixed();
			} else {
				// not a valid color
			}
		});
		
		//
		ctrPicker.hueInput.addEventListener('input', (e) => {
			const RGX_5_DIGITS = /^\d{1,5}$/i;
			let hueText = ctrPicker.hueInput.value.trim();
			
			if (RGX_5_DIGITS.test(hueText)) {
				let h = parseInt(hueText);
				
				setHueMarkerByAngle(0, h);
				CPicker.triangle = updateColorWheel(CPicker.markers.hue[0].angle);
				setSatValMarkerByNumber(
					0,
					CPicker.markers.satv[0].sat,
					CPicker.markers.satv[0].val,
					CPicker.triangle
				);
				drawMarkers();
				
				updateHexInput();
			} else {
				// not a valid color
			}
		});
		
		//
		bindListenerToNodes([
			ctrPicker.satInput,
			ctrPicker.valInput
		], 'input', (e) => {
			const RGX_3_DIGITS = /^\d{1,3}$/i;
			let satvalText = e.target.value.trim();
			
			if (
				RGX_3_DIGITS.test(satvalText)
			) {
				let s = minmax(parseFloat(
					ctrPicker.satInput.value.trim()
				), 0, 100) / 100;
				let v = minmax(parseFloat(
					ctrPicker.valInput.value.trim()
				), 0, 100) / 100;
				
				setHueMarkerByAngle(0, CPicker.markers.hue[0].angle);
				CPicker.triangle = updateColorWheel(CPicker.markers.hue[0].angle);
				setSatValMarkerByNumber(0, s, v, CPicker.triangle);
				drawMarkers();
				
				updateHexInput();
			} else {
				// not a valid color
			}
		});
		
		//
		ctrPicker.alphaInput.addEventListener('input', (e) => {
			const RGX_3_DIGITS = /^\d{1,3}$/i;
			let alphaText = ctrPicker.alphaInput.value.trim();
			
			if (
				RGX_3_DIGITS.test(alphaText)
			) {
				let a = minmax(parseFloat(
					ctrPicker.alphaInput.value.trim()
				), 0, 100) / 100;
				
				ctrPicker.alphaSlider.value = a;
				updateHexInput();
			} else {
				// not a valid color
			}
		});
		
		// filter alphanumeric input for hex values
		ctrPicker.hexInput.addEventListener('keydown', (e) => {
			if (
				!RGX_NAMED_KEY.test(e.key) &&
				!e.altKey && !e.ctrlKey &&
				!RGX_HEX_KEY.test(e.key)
			) {
				// cancels the input of non-valid characters
				// but allows keyboard shortcuts and named special keys
				e.preventDefault();
				return false;
			}
		});
		
		// prevents pasting invalid values in hex color
		ctrPicker.hexInput.addEventListener('paste', (e) => {
			const RGX_HEX_STRING = /^#?(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
			let inText = e.clipboardData.getData('text/plain');
			
			if (RGX_HEX_STRING.test(inText)) {
				ctrPicker.hexInput.value = "";
			} else {
				e.preventDefault();
				return false;
			}
		});
		
		// prevent pasting invalid values in hue
		ctrPicker.hueInput.addEventListener('paste', (e) => {
			const RGX_5_DIGITS = /^\d{1,5}$/i;
			let inText = e.clipboardData.getData('text/plain');
			
			if (RGX_5_DIGITS.test(inText)) {
				ctrPicker.hueInput.value = "";
			} else {
				e.preventDefault();
				return false;
			}
		});
		
		// prevent pasting invalid values in 3-digit fields
		bindListenerToNodes([
			ctrPicker.satInput,
			ctrPicker.valInput,
			ctrPicker.alphaInput
		], 'paste', (e) => {
			const RGX_3_DIGITS = /^\d{1,3}$/i;
			let inText = e.clipboardData.getData('text/plain');
			
			if (RGX_3_DIGITS.test(inText)) {
				e.target.value = "";
			} else {
				e.preventDefault();
				return false;
			}
		});
		
		// filter numeric input for fields for color values
		bindListenerToNodes([
			ctrPicker.hueInput,
			ctrPicker.satInput,
			ctrPicker.valInput,
			ctrPicker.alphaInput
		], 'keydown', (e) => {
			if (
				!RGX_NAMED_KEY.test(e.key) &&
				!e.altKey && !e.ctrlKey &&
				!RGX_NUM_KEY.test(e.key)
			) {
				// cancels the input of non-valid characters
				// but allows keyboard shortcuts and named special keys
				e.preventDefault();
				return false;
			}
		});
		
		bindListenerToNodes([
			ctrPicker.hexInput,
			ctrPicker.hueInput,
			ctrPicker.satInput,
			ctrPicker.valInput,
			ctrPicker.alphaInput
		], 'focus', (e) => {
			e.target.select();
		});
		
		// mouse button event of color picker
		ctrPicker.colorWheel.addEventListener('mousedown', (e) => {
			if (e.buttons === 1) {
				let mse = getCanvasMse(ctrPicker.colorWheel, e, CPicker.canvasOffset);
				
				if (!setMarkerByMouse(mse)) {
					fetchValidMarker(mse);
					setMarkerByMouse(mse);
				}
			}
		});
		
		// move event of color picker
		ctrPicker.colorWheel.addEventListener('mousemove', (e) => {
			let mse = getCanvasMse(ctrPicker.colorWheel, e, CPicker.canvasOffset);
			
			if (e.buttons === 0) {
				CPicker.markers.active = selectMarker(mse);
			} else if (e.buttons === 1) {
				setMarkerByMouse(mse);
			}
		});
		
		// finds a valid marker on canvas given a mouse location
		function fetchValidMarker(mse) {
			if (
				distance(mse, {x: CANV_MID, y: CANV_MID}) > WHEEL_RAD_IN
			) {
				CPicker.markers.active = {
					type: 'hue', id: 0
				};
			} else if (
				isInTriangle(mse, CPicker.triangle)
			) {
				CPicker.markers.active = {
					type: 'satv', id: 0
				};
			} else {
				return false;
			}
			
			return true;
		}
		
		// sets active marker with given mouse location
		function setMarkerByMouse(mse) {
			if (CPicker.markers.active === null) return false;
			
			switch (CPicker.markers.active.type) {
				case 'hue':
					setHueMarkerByMse(CPicker.markers.active.id, mse);
					CPicker.triangle = updateColorWheel(CPicker.markers.hue[0].angle);
					setSatValMarkerByNumber(
						CPicker.markers.active.id,
						CPicker.markers.satv[CPicker.markers.active.id].sat,
						CPicker.markers.satv[CPicker.markers.active.id].val,
						CPicker.triangle
					);
					drawMarkers();
					updateTextInputs();
					break;
				case 'satv':
					setSatValMarkerByMse(CPicker.markers.active.id, mse, CPicker.triangle);
					// this should not update CPicker.triangle ever
					updateColorWheel(CPicker.markers.hue[0].angle);
					drawMarkers();
					updateTextInputs();
					break;
				default:
					// throw; // ADD CUSTOM ERROR
			}
			
			return true;
		}
		
		// gets the mouse location of an element (including border)
		function getCanvasMse(canvas, evt, offset) {
			var rect = canvas.getBoundingClientRect();
			return {
				x: evt.clientX - rect.left - offset.x,
				y: evt.clientY - rect.top - offset.y
			};
		}
		
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// DOM Helper functions
	
	// creates a tree of elements and appends them into parentNode. Returns an object containing all named nodes
	function insertNodes(parentNode, nodeTree) {
		function recurseTree (parent, nextTree, nodeAdder) {
			for (let branch of nextTree.group) {
				if (!branch.hasOwnProperty('tag')) {
					throw new CustomError('Parameter Error', 'Tag type is not defined');
				}
				let child = document.createElement(branch.tag);
				parent.appendChild(child);
				
				if (branch.hasOwnProperty('varName')) {
					nodeAdder[branch.varName] = child;
				}
				if (branch.hasOwnProperty('id')) {
					child.setAttribute('id', branch.id);
				}
				if (branch.hasOwnProperty('classes')) {
					child.classList.add(...branch.classes);
				}
				if (branch.hasOwnProperty('styles')) {
					Object.assign(child.style, branch.styles);
				}
				if (branch.hasOwnProperty('attributes')) {
					branch.attributes.forEach(elem => {
						child.setAttribute(elem.name, elem.value);
					});
				}
				if (branch.hasOwnProperty('nodeContent')) {
					child.innerHTML = branch.nodeContent;
				}
				if (branch.hasOwnProperty('group')) {
					recurseTree(child, branch, nodeAdder); // they grow so fast :')
				}
			}
			return nodeAdder;
		}
		return recurseTree(parentNode, nodeTree, []);
	}
	
	// appends a text node to the end of the node queried by id
	function appendTextToNode(id, text) {
		let elem = document.getElementById(id);
		let textNode = document.createTextNode(text);
		elem.appendChild(textNode);
	}
	
	// returns attribute of first instance of query
	function seekAttribute(parent, selectors, attName) {
		let node = parent.querySelector(selectors);
		
		if (!(node === null && typeof node.getAttributeNames !== 'function')) {
			return node.getAttribute(attName);
		}
		
		return null;
	}
	
	// returns parent of first instance of query
	function getParentByQuery(node, selectors) {
		let targetChild = node.querySelector(selectors);
		if (targetChild === null) return null;
		return targetChild.parentNode;
	}
	
	// binds a list of elements to a single callback on the same listener
	function bindListenerToNodes(elemList, eventName, callback) {
		for (let elem of elemList) {
			elem.addEventListener(eventName, callback);
		}
	}
	
	// stackoverflow: q:11442712, a:11442850
	// get image metadata
	function getMeta(url, callback) {
		if (!callback instanceof Function) return;
		var img = new Image();
		img.onload = callback;
		img.src = url;
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// Desmos Helper Functions
	
	// returns the corresponding index for a given id of an expression
	function getExprIndex(id) {
		let exprs = Calc.getState().expressions.list;
		return exprs.findIndex((elem) => {
			return elem.id === id;
		});
	}
	
	// gets an expression item of given index using getState
	function getStateExpr(index) {
		return Calc.getState().expressions.list[index];
	}
	
	// gets an expression item of given index using getExpressions
	function getPureExpr(index) {
		return Calc.getExpressions()[index];
	}
	
	// sets the color of an expression
	function setExprColor(target, newColor) {
		let expr = Calc.getExpressions()[target.index];
		
		switch (true) {
			case expr.type === 'expression':
				Calc.setExpression({
					id: expr.id,
					color: newColor
				});
				break;
				
			case expr.type === 'table':
				expr.columns[target.colIndex].color = newColor;
				Calc.setExpression({
					type: 'table',
					id: expr.id,
					columns: expr.columns
				});
				break;
				
			default:
				// not a valid type
		}
	}
	
	// sets the property of an expression by id using setExpression
	function setExprProp(eID, {key, value}) {
		Calc.setExpression({
			id: eID,
			[key]: value
		});
	}
	
	// sets the property of an expression by index using setState
	function setStateProp(index, {key, value}) {
		let state = Calc.getState();
		state.expressions.list[index][key] = value;
		Calc.setState(state, {allowUndo: true});
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// Mathematical Helper Functions
	
	// returns a positive coterminal angle
	function getCoterminalAngle(src, max = 360) {
		if (src >= 0 && src < max) return src;
		const mod = (n, m) => (n * m >= 0 ? n % m : n % m + m);
		return mod(src, max);
	}
	
	// returns a number confined by min and max (inclusive)
	function minmax(num, min, max) {
		return Math.min(Math.max(num, min), max);
	}
	
	// returns the distance between the points a and b
	function distance(a, b) {
		return Math.hypot(b.x - a.x, b.y - a.y);
	}
	
	// returns a point that is in the middle of a and b
	function midpoint(a, b) {
		return {
			x: (a.x + b.x) / 2,
			y: (a.y + b.y) / 2
		};
	}
	
	// gets the normal vector of the input
	function getNormal(v) {
		return {
			x: -v.y,
			y: v.x
		};
	}
	
	// returns the linear interpolation of a and b at t
	function vecLerp(a, b, t) {
		return {
			x: (1 - t) * a.x + t * b.x,
			y: (1 - t) * a.y + t * b.y
		};
	}
	
	// returns how far perpendicularly p is from a line that passes thru a and b
	function getWinding(p, a, b) {
		return (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
	}
	
	// finds the intersection point between lines (a1, a2) and (b1, b2)
	function findIntersection(a1, a2, b1, b2) {
		// denominator might be zero and return NaN
		return (
			(b1.x - a1.x) * (b1.y - b2.y) - (b1.y - a1.y) * (b1.x - b2.x)
		) / (
			(a2.x - a1.x) * (b1.y - b2.y) - (a2.y - a1.y) * (b1.x - b2.x)
		);
	}
	
	// projects v1 onto the normal of v2 offset to the head of v2
	function normalProjection(v1, v2) {
		// equation written by u/MLGcrumpets
		let sq2x = v2.x * v2.x;
		let sq2y = v2.y * v2.y;
		
		return {
			x: (sq2y * (v2.x + v1.x) + v2.x * (sq2x - v2.y * v1.y)) / (sq2y + sq2x),
			y: (sq2x * (v2.y + v1.y) + v2.y * (sq2y - v2.x * v1.x)) / (sq2y + sq2x)
		};
	}
	
	// determines if loc is inside a triangle
	function isInTriangle(loc, triVtx) {
		return (
			getWinding(loc, triVtx[0], triVtx[1]) > 0 &&
			getWinding(loc, triVtx[1], triVtx[2]) > 0 &&
			getWinding(loc, triVtx[2], triVtx[0]) > 0
		);
	}
	
	// returns a value confined to the boundaries of a triangle
	function getConfinedProbe(loc, triVtx) {
		/*jshint bitwise: false */
		const AREA_OUT_A = 2;
		const AREA_OUT_B = 4;
		const AREA_OUT_C = 1;
		const AREA_OUT_AB = AREA_OUT_A | AREA_OUT_B;
		const AREA_OUT_BC = AREA_OUT_B | AREA_OUT_C;
		const AREA_OUT_CA = AREA_OUT_C | AREA_OUT_A;
		const AREA_IN = AREA_OUT_A | AREA_OUT_B | AREA_OUT_C;
		
		let A = triVtx[0];
		let B = triVtx[1];
		let C = triVtx[2];
		let ab = getWinding(loc, A, B);
		let bc = getWinding(loc, B, C);
		let ca = getWinding(loc, C, A);
		
		let bitfi = (ab > 0 ? 1 : 0) | (bc > 0 ? 2 : 0) | (ca > 0 ? 4 : 0);
		/*jshint bitwise: true */
		
		switch (true) {
			case bitfi === AREA_IN:
				return loc;
			case bitfi === AREA_OUT_AB:
				return vecLerp(loc, C, findIntersection(loc, C, A, B));
			case bitfi === AREA_OUT_BC:
				return vecLerp(loc, A, findIntersection(loc, A, B, C));
			case bitfi === AREA_OUT_CA:
				return vecLerp(loc, B, findIntersection(loc, B, C, A));
			case bitfi === AREA_OUT_A:
				return A;
			case bitfi === AREA_OUT_B:
				return B;
			case bitfi === AREA_OUT_C:
				return C;
			default:
				// throw; // ADD CUSTOM ERROR
		}
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// General Helper Functions
	
	// add constant property
	function constProperty(val) {
		return {
			value: val,
			writable: false,
			enumerable: true,
			configurable: true
		};
	}
	
	// determines if two arrays are equal (memberwise)
	function isEqual(lhs, rhs) {
		if (lhs.length !== rhs.length) return false;
		let output = true;
		for (var i = 0; i < lhs.length; ++i) {
			output = output && lhs[i] === rhs[i];
			if (!output) return output;
		}
		return output;
	}
	
	// returns a function that maps between the specified color spaces
	function mapToColorSpace(clFrom, clTo) {
		if (clFrom === clTo) return (...args) => args[0];
		
		let convFunc;
		let rxAlpha;
		
		switch (true) {
			case /rgba?/.test(clFrom) && /rgba?/.test(clTo):
				convFunc = (r, g, b) => [r, g, b];
				rxAlpha = /[a-z]{3}a/;
				break;
			case /rgba?/.test(clFrom) && /hsla?/.test(clTo):
				convFunc = getHSLfromRGB;
				rxAlpha = /[a-z]{3}a/;
				break;
			case /rgba?/.test(clFrom) && /hs[vb]a?/.test(clTo):
				convFunc = getHSVfromRGB;
				rxAlpha = /[a-z]{3}a/;
				break;
			case /hsla?/.test(clFrom) && /hsla?/.test(clTo):
				convFunc = (h, s, l) => [h, s, l];
				rxAlpha = /[a-z]{3}a/;
				break;
			case /hsla?/.test(clFrom) && /rgba?/.test(clTo):
				convFunc = getRGBfromHSL;
				rxAlpha = /[a-z]{3}a/;
				break;
			case /hsla?/.test(clFrom) && /hs[vb]a?/.test(clTo):
				convFunc = getHSVfromHSL;
				rxAlpha = /[a-z]{3}a/;
				break;
			case /hs[vb]a?/.test(clFrom) && /hs[vb]a?/.test(clTo):
				convFunc = (h, s, v) => [h, s, v];
				rxAlpha = /[a-z]{3}a/;
				break;
			case /hs[vb]a?/.test(clFrom) && /rgba?/.test(clTo):
				convFunc = getRGBfromHSV;
				rxAlpha = /[a-z]{3}a/;
				break;
			case /hs[vb]a?/.test(clFrom) && /hsla?/.test(clTo):
				convFunc = getHSLfromHSV;
				rxAlpha = /[a-z]{3}a/;
				break;
			default:
				throw new CustomError('Argument error', `There is no conversion between ${clFrom} and ${clTo}`);
		}
		
		/*jshint bitwise: false */
		// bitfield to decide what to do with alpha disparity
		let aBf = (rxAlpha.test(clFrom) ? 1 : 0) | (rxAlpha.test(clTo) ? 2 : 0);
		/*jshint bitwise: true */
		
		switch (aBf) {
			case 0: // none to none - does nothing
				return (args) => convFunc(...args);
			case 1: // alpha to none - alpha value gets ignored
				return (args) => {return convFunc(...args);};
			case 2: // none to alpha - 1 is added as alpha value
				return (args) => {return convFunc(...args).concat(1);};
			case 3: // alpha to alpha - alpha value gets added to output
				return (args) => {let al = args.pop(); return convFunc(...args).concat(al);};
			default:
				throw new CustomError('Unknown error', `The bitfield has a value of ${aBf}. What kind of sorcery is this?`);
		}
	}
	
	// returns an array with RGB values from an HSL color space
	function getRGBfromHSL(hue, sat, light) {
		const mod = (n, m) => (n * m >= 0 ? n % m : n % m + m);
		let ls_ratio = Math.min(light, 1 - light)*sat;
		
		return [0, 8, 4].map((offset, i) => {
			return mod((offset + hue/30), 12);
		}).map((kval, i) => {
			return light - ls_ratio*Math.max(Math.min(Math.min(kval - 3, 9 - kval), 1), -1);
		});
	}
	
	// returns an array with RGB values from an HSV color space
	function getRGBfromHSV(hue, sat, value) {
		const mod = (n, m) => (n * m >= 0 ? n % m : n % m + m);
		let vs_ratio = value*sat;
		
		return [5, 3, 1].map((offset, i) => {
			return mod((offset + hue/60), 6);
		}).map((kval, i) => {
			return value - vs_ratio*Math.max(Math.min(Math.min(kval, 4 - kval),1),0);
		});
	}
	
	// returns an array with HSV values from an RGB color space
	function getHSVfromRGB(red, green, blue) {
		let value = Math.max(red, green, blue);
		let range = value - Math.min(red, green, blue);
		
		let sat = (value === 0 ? 0 : range / value);
		let hue;
		if (range === 0)					hue = 0;
		else if (value === red) 	hue = 60 * (green - blue) / range;
		else if (value === green)	hue = 60 * (2 + (blue - red) / range);
		else if (value === blue)	hue = 60 * (4 + (red - green) / range);
		
		return [hue, sat, value];
	}
	
	// returns an array with HSV values from an HSL color space
	function getHSVfromHSL(hue, sat, light) {
		let v = light + sat * Math.min(light, 1 - light);
		let s = (v == 0 ? 0 : 2 * (1 - light / v));
		return [hue, s, v];
	}
	
	// returns an array with HSL values from an RGB color space
	function getHSLfromRGB(red, green, blue) {
		let max = Math.max(red, green, blue);
		let range = max - Math.min(red, green, blue);
		
		let li = max - range / 2;
		let sat = (li == 0 || li == 1 ? 0 : (max - li) / Math.min(li, 1 - li));
		let hue;
		if (range === 0)				hue = 0;
		else if (max === red) 	hue = 60 * (green - blue) / range;
		else if (max === green)	hue = 60 * (2 + (blue - red) / range);
		else if (max === blue)	hue = 60 * (4 + (red - green) / range);
		
		return [hue, sat, li];
	}
	
	// returns an array with HSL values from an HSV color space
	function getHSLfromHSV(hue, sat, value) {
		let li = value * (1 - sat / 2);
		let s = (li == 0 || li == 1 ? 0 : (value - li) / Math.min(li, 1 - li));
		return [hue, s, li];
	}
	
	// returns an array containing the CSS funcion name and its parameters destructured and normalized (except for degree angles those stay as they are)
	function parseCSSFunc(value) {
		if (typeof value !== 'string') throw new CustomError('Argument error', 'value is not a valid string');
		const rxSignature = /^([a-zA-Z]+)(\(.+\))$/i;
		const rxArgs = /\(\s*([+-]?(?:\d*?\.)?\d+%?)\s*,\s*([+-]?(?:\d*?\.)?\d+%?)\s*,\s*([+-]?(?:\d*?\.)?\d+%?)\s*(?:,\s*([+-]?(?:\d*?\.)?\d+%?)\s*)?\)/;
		
		// map of non-numbers as parameters
		const NUMMAP_RGB = [false, false, false];
		const NUMMAP_HSL = [false, true, true];
		
		// gets function name and argument set
		let [ , funcName = '', argSet = ''] = value.trim().match(rxSignature) || [];
		// matches the list of arguments (trimmed)
		let args = argSet.match(rxArgs);
		if (args === null) throw new CustomError('Type error', 'the value provided is not a CSS function');
		// remove full match and alpha from array, store alpha in variable
		let alpha = (args = args.slice(1)).pop();
		// truthy map if argument evaluates as NaN
		let pType = args.map(isNaN);
		
		let output;
		
		// select the format of parameters
		switch (true) {
			case funcName === 'rgb':
			case funcName === 'rgba':
				if (!isEqual(pType, NUMMAP_RGB)) throw new CustomError('Argument error', 'RGB arguments are not valid');
				output = args.map((num) => {
					return parseFloat(num / 255);
				});
				
				break;
			case funcName === 'hsl':
			case funcName === 'hsla':
				if (!isEqual(pType, NUMMAP_HSL)) throw new CustomError('Argument error', 'HSL parameters are not valid');
				output = args.map(parseFloat).map((num, i) => {
					return num * (pType[i] ? 0.01 : 1);
				});
				break;
			default:
				throw new CustomError('Argument error', `${funcName} is not a recognized CSS function`);
		}
		
		if (typeof alpha !== 'undefined') {
			if (funcName.length === 3) throw new CustomError('Argument error', `${funcName} function only recieves 3 arguments`);
			output.push(parseFloat(alpha) * (isNaN(alpha) ? 0.01 : 1));
		}
		
		return [funcName].concat(output);
	}
	
	// returns an array containing a desctructured version of a valid CSS hex color
	function parseCSSHex(value, numeric = false) {
		if (typeof value !== 'string') throw new CustomError('Argument error', 'value is not a valid string');
		const rxHex = /^#((?:[0-9a-z]){3,8})$/i;
		
		let hex = value.match(rxHex);
		if (hex === null) throw new CustomError('Type error', 'the value provided is not a CSS hex color');
		hex = hex[1];
		
		let output;
		switch (hex.length) {
			case 3:
				output = hex.match(/(.)(.)(.)/).splice(1);
				output = output.map(elem => elem + elem);
				break;
			case 6:
				output = hex.match(/(..)(..)(..)/).splice(1);
				break;
			case 4:
				output = hex.match(/(.)(.)(.)(.)/).splice(1);
				output = output.map(elem => elem + elem);
				break;
			case 8:
				output = hex.match(/(..)(..)(..)(..)/).splice(1);
				break;
			default:
				throw new CustomError('Argument error', `${value} is not a valid CSS hex color`);
		}
		
		if (numeric) {
			output = output.map((item) => {
				return (Number(`0x${item}`)) / 255;
			});
		}
		
		return output;
	}
	
	// Retruns the CSS hex value of given named CSS color
	function parseNamedColor(input) {
		const NAME_TABLE = {
			'black' : '#000000', 'navy' : '#000080',
			'darkblue' : '#00008b', 'mediumblue' : '#0000cd',
			'blue' : '#0000ff', 'darkgreen' : '#006400',
			'green' : '#008000', 'teal' : '#008080',
			'darkcyan' : '#008b8b', 'deepskyblue' : '#00bfff',
			'darkturquoise' : '#00ced1', 'mediumspringgreen' : '#00fa9a',
			'lime' : '#00ff00', 'springgreen' : '#00ff7f',
			'aqua' : '#00ffff', 'cyan' : '#00ffff',
			'midnightblue' : '#191970', 'dodgerblue' : '#1e90ff',
			'lightseagreen' : '#20b2aa', 'forestgreen' : '#228b22',
			'seagreen' : '#2e8b57', 'darkslategray' : '#2f4f4f',
			'darkslategrey' : '#2f4f4f', 'limegreen' : '#32cd32',
			'mediumseagreen' : '#3cb371', 'turquoise' : '#40e0d0',
			'royalblue' : '#4169e1', 'steelblue' : '#4682b4',
			'darkslateblue' : '#483d8b', 'mediumturquoise' : '#48d1cc',
			'indigo' : '#4b0082', 'darkolivegreen' : '#556b2f',
			'cadetblue' : '#5f9ea0', 'cornflowerblue' : '#6495ed',
			'rebeccapurple' : '#663399', 'mediumaquamarine' : '#66cdaa',
			'dimgray' : '#696969', 'dimgrey' : '#696969',
			'slateblue' : '#6a5acd', 'olivedrab' : '#6b8e23',
			'slategray' : '#708090', 'slategrey' : '#708090',
			'lightslategray' : '#778899', 'lightslategrey' : '#778899',
			'mediumslateblue' : '#7b68ee', 'lawngreen' : '#7cfc00',
			'chartreuse' : '#7fff00', 'aquamarine' : '#7fffd4',
			'maroon' : '#800000', 'purple' : '#800080',
			'olive' : '#808000', 'gray' : '#808080',
			'grey' : '#808080', 'skyblue' : '#87ceeb',
			'lightskyblue' : '#87cefa', 'blueviolet' : '#8a2be2',
			'darkred' : '#8b0000', 'darkmagenta' : '#8b008b',
			'saddlebrown' : '#8b4513', 'darkseagreen' : '#8fbc8f',
			'lightgreen' : '#90ee90', 'mediumpurple' : '#9370db',
			'darkviolet' : '#9400d3', 'palegreen' : '#98fb98',
			'darkorchid' : '#9932cc', 'yellowgreen' : '#9acd32',
			'sienna' : '#a0522d', 'brown' : '#a52a2a',
			'darkgray' : '#a9a9a9', 'darkgrey' : '#a9a9a9',
			'lightblue' : '#add8e6', 'greenyellow' : '#adff2f',
			'paleturquoise' : '#afeeee', 'lightsteelblue' : '#b0c4de',
			'powderblue' : '#b0e0e6', 'firebrick' : '#b22222',
			'darkgoldenrod' : '#b8860b', 'mediumorchid' : '#ba55d3',
			'rosybrown' : '#bc8f8f', 'darkkhaki' : '#bdb76b',
			'silver' : '#c0c0c0', 'mediumvioletred' : '#c71585',
			'indianred' : '#cd5c5c', 'peru' : '#cd853f',
			'chocolate' : '#d2691e', 'tan' : '#d2b48c',
			'lightgray' : '#d3d3d3', 'lightgrey' : '#d3d3d3',
			'thistle' : '#d8bfd8', 'orchid' : '#da70d6',
			'goldenrod' : '#daa520', 'palevioletred' : '#db7093',
			'crimson' : '#dc143c', 'gainsboro' : '#dcdcdc',
			'plum' : '#dda0dd', 'burlywood' : '#deb887',
			'lightcyan' : '#e0ffff', 'lavender' : '#e6e6fa',
			'darksalmon' : '#e9967a', 'violet' : '#ee82ee',
			'palegoldenrod' : '#eee8aa', 'lightcoral' : '#f08080',
			'khaki' : '#f0e68c', 'aliceblue' : '#f0f8ff',
			'honeydew' : '#f0fff0', 'azure' : '#f0ffff',
			'sandybrown' : '#f4a460', 'wheat' : '#f5deb3',
			'beige' : '#f5f5dc', 'whitesmoke' : '#f5f5f5',
			'mintcream' : '#f5fffa', 'ghostwhite' : '#f8f8ff',
			'salmon' : '#fa8072', 'antiquewhite' : '#faebd7',
			'linen' : '#faf0e6', 'lightgoldenrodyellow' : '#fafad2',
			'oldlace' : '#fdf5e6', 'red' : '#ff0000',
			'fuchsia' : '#ff00ff', 'magenta' : '#ff00ff',
			'deeppink' : '#ff1493', 'orangered' : '#ff4500',
			'tomato' : '#ff6347', 'hotpink' : '#ff69b4',
			'coral' : '#ff7f50', 'darkorange' : '#ff8c00',
			'lightsalmon' : '#ffa07a', 'orange' : '#ffa500',
			'lightpink' : '#ffb6c1', 'pink' : '#ffc0cb',
			'gold' : '#ffd700', 'peachpuff' : '#ffdab9',
			'navajowhite' : '#ffdead', 'moccasin' : '#ffe4b5',
			'bisque' : '#ffe4c4', 'mistyrose' : '#ffe4e1',
			'blanchedalmond' : '#ffebcd', 'papayawhip' : '#ffefd5',
			'lavenderblush' : '#fff0f5', 'seashell' : '#fff5ee',
			'cornsilk' : '#fff8dc', 'lemonchiffon' : '#fffacd',
			'floralwhite' : '#fffaf0', 'snow' : '#fffafa',
			'yellow' : '#ffff00', 'lightyellow' : '#ffffe0',
			'ivory' : '#fffff0', 'white' : '#ffffff'
		}; // !NAME_TABLE
		
		if (NAME_TABLE.hasOwnProperty(input.toLowerCase())) {
			return NAME_TABLE[input.toLowerCase()];
		} else {
			throw new CustomError('Type error', input + ' is not a recognized named color');
		}
	}
	
	// converts a hsl pack into an hsl CSS function
	function getCSS_hsl(hue, sat, light, alpha = 1) {
		if (alpha === 1) {
			return `hsl(${hue},${sat * 100}%,${light * 100}%)`;
		} else {
			return `hsla(${hue},${sat * 100}%,${light * 100}%,${alpha})`;
		}
	}
	
	// returns a 6-digit hex of any given CSS color
	function getHex6(cssColor) {
		let output;
		
		// try if cssColor is a named color
		try {
			output = parseNamedColor(cssColor);
			return output;
		} catch (e) {
			// no need to log error, color might still be parsable
		}
		
		// try if cssColor is a hex value
		try {
			output = parseCSSHex(cssColor);
			// get rid of alpha channel if it exists
			if (output.length === 4) output.pop();
			
			// pads with 0 if number is less than 0x10
			output = output.map((item) => {
				return (item.length === 1 ? '0' : '') + item;
			});
			
			// merges numbers into hex format #nnnnnn
			return `#${output.join('')}`;
			
		} catch (e) {
			// no need to log error, color might still be parsable
		}
		
		// try if cssColor is a function
		try {
			output = parseCSSFunc(cssColor);
			let funcName = output.splice(0, 1)[0];
			
			// maps current color space onto rgb and converts the normalized coefficients onto a hexadecimal string
			output = (mapToColorSpace(funcName, 'rgb')(output)).map((num) => {
				return Math.trunc(num * 255).toString(16);
			});
			
			// pads with 0 if number is less than 0x10
			output = output.map((item) => {
				return (item.length === 1 ? '0' : '') + item;
			});
			
			output = `#${output.join('')}`;
		} catch (e) {
			console.error(`${e.name}:${e.message}`);
			output = '#7F7F7F';
		} finally {
			return output;
		}
		
	}
	
	// returns an HSV array from any given CSS color
	function getHSVpack(cssColor) {
		let output;
		
		// try if cssColor is a named color
		try {
			output = parseCSSHex(parseNamedColor(cssColor), true);
			output = mapToColorSpace('rgb', 'hsva')(output);
			return output;
		} catch (e) {
			// no need to log error, color might still be parsable
		}
		
		// try if cssColor is a hex value
		try {
			output = parseCSSHex(cssColor, true);
			if (output.length === 4) {
				output = mapToColorSpace('rgba', 'hsva')(output);
			} else {
				output = mapToColorSpace('rgb', 'hsva')(output);
			}
			return output;
		} catch (e) {
			// no need to log error, color might still be parsable
		}
		
		// try if cssColor is a function
		try {
			output = parseCSSFunc(cssColor);
			let funcName = output.splice(0, 1)[0];
			
			// maps current color space onto hsv
			output = mapToColorSpace(funcName, 'hsva')(output);
		} catch (e) {
			console.error(`${e.name}:${e.message}`);
			output = [0, 0.5, 0, 1]; // gray
		} finally {
			return output;
		}
	}
	
	// returns an RGB array from any given CSS color
	function getRGBpack(cssColor) {
		let output;
		
		// try if cssColor is a named color
		try {
			return parseCSSHex(parseNamedColor(cssColor), true);
		} catch (e) {
			// no need to log error, color might still be parsable
		}
		
		// try if cssColor is a hex value
		try {
			return parseCSSHex(cssColor, true);
		} catch (e) {
			// no need to log error, color might still be parsable
		}
		
		// try if cssColor is a function
		try {
			output = parseCSSFunc(cssColor);
			let funcName = output.splice(0, 1)[0];
			
			// maps current color space onto rgb
			output = mapToColorSpace(funcName, 'rgba')(output);
		} catch (e) {
			console.error(`${e.name}:${e.message}`);
			output = [0.5, 0.5, 0.5, 1]; // gray
		} finally {
			return output;
		}
	}
	
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
				
				initGUI();
				initColorPicker();
				loadEvents();
				loadColorPickerListeners();
				
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
	
} ());
