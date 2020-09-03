// ==UserScript==
// @name     	DesmosArtTools
// @namespace	slidav.Desmos
// @version  	1.2.0
// @author		SlimRunner (David Flores)
// @description	Adds a color picker to Desmos
// @grant    	none
// @match			https://*.desmos.com/calculator*
// @downloadURL	https://github.com/SlimRunner/desmos-scripts-addons/raw/master/art-tools-script/dgc-art-tools.user.js
// @updateURL	https://github.com/SlimRunner/desmos-scripts-addons/raw/master/art-tools-script/dgc-art-tools.user.js
// ==/UserScript==

/*jshint esversion: 6 */

// BUG: shortcuts during dialogs propagate back to Desmos allowing shortcuts to mutate the graph while an element is being edited.
// try https://stackoverflow.com/a/53329665

(function() {
	'use strict';
	var Calc;
	var Desmos;
	
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
	
	// MathQuill wrapper
	class MQField {
		constructor(node, callback) {
			this.target = node;
			this.mathField = Desmos.MathQuill.MathField(node, {
				handlers: { edit: callback }
			});
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
	
	// mouse state values of the latex dialog
	const MseDial = Object.defineProperties({}, {
		NORMAL_STATE : constProperty(0),
		SELECT_STATE : constProperty(1),
		EXIT_STATE : constProperty(2)
	});
	
	// stores the state of the latex dialog
	const DialLtx = Object.assign({}, {
		show: showLatexDialog,
		hide: hideLatexDialog,
		onChange: null,
		dispatcher: null,
		mseState: 0,
		MQ: null,
		
		result: {
			value: '',
			initValue: '',
			action: DialogResult.None,
			changed: function () {
				return (this.value !== this.initValue);
			}
		}
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
	
	// stores all controls used in the script
	var ctrColor;
	var ctrLatex;
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
					border-radius: 5px;
					background-color: white;
					background-size: 10px 10px;
					background-position: 0 0, 5px 5px;
					background-image: linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc);
				}
				
				.sli-dat-color-prev {
					display: block;
					width: 100%;
					height: 100%;
					background: black;
					border-radius: 3px;
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
					tag : 'div',
					varName : 'opacityButton',
					attributes: [
						{name: 'title', value: 'Opacity'}
					],
					classes : [
						'sli-menu-button',
						'dcg-btn-flat-gray',
						'sli-dcg-icon-align'
					],
					group : [{
						tag : 'i',
						classes : [
							'dcg-icon-shaded-inequality-shade2'
						]
					}]
				}, {
					tag : 'div',
					varName : 'widthButton',
					attributes: [
						{name: 'title', value: 'Line Width'}
					],
					classes : [
						'sli-menu-button',
						'dcg-btn-flat-gray',
						'sli-dcg-icon-align'
					],
					group : [{
						tag : 'i',
						classes : [
							'dcg-icon-pencil'
						]
					}]
				}]
			}]
		});
		
		// groups all buttons from context menu in a list
		buttonList = [
			ctrColor.colorButton,
			ctrColor.opacityButton,
			ctrColor.widthButton
		];
		
		// executes a function when the color menu is triggered
		hookMenu('.dcg-options-menu-column-left', seekColorContext,
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
			}
		});
		
	}
	
	// triggers a callback whenever an expression menu in Desmos is deployed
	function hookMenu(mainQuery, scrapePredicate, callback) {
		// initializes observer
		let menuObserver = new MutationObserver( obsRec => {
			let menuElem;
			let isFound = false;
			
			// seek for color context menu, sets isFound to true when found
			obsRec.forEach((record) => {
				record.addedNodes.forEach((node) => {
					if ( typeof node.querySelector === 'function' && !isFound) {
						menuElem = getParentByQuery(node, mainQuery);
						if (menuElem !== null) isFound = true;
					}
				});
			});
			
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
		return stExpr.type === 'expression' && (stExpr.fill === true ||
			stExpr.latex.indexOf('\\operatorname{polygon}') !== -1);
	}
	
	// dynamically show of hide buttons
	function prepareMenu() {
		let stExpr = getStateExpr(ActiveItem.expression.index);
		
		if (isFillable(stExpr)) {
			ctrColor.opacityButton.style.display = 'block';
		} else {
			ctrColor.opacityButton.style.display = 'none';
		}
		
		if (stExpr.type === 'table') {
			ctrColor.widthButton.style.display = 'none';
		} else {
			ctrColor.widthButton.style.display = 'block';
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
	
	function updateColorPreview() {
		ctrColor.colorButtonPreview.style.background = getCurrentColor();
	}
	
	// returns color of expression with the menu active
	function getCurrentColor() {
		let expr = getPureExpr(ActiveItem.expression.index);
		
		if (expr.type === 'expression') {
			return expr.color;
			
		} else if (expr.type === 'table') {
			return expr.columns[ActiveItem.expression.colIndex].color;
			
		}
		
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// GUI Management - Dialog
	
	// initializes the latex dialog interface
	function initLatexDialog() {
		// insert css styles into existing stylesheet
		appendTextToNode('sli-script-stylesheet',
		`/* LATEX DIALOG */
		
		.sli-mq-container {
			position: fixed;
			left: 0;
			top: 0;
			/* z-index:99; */
			/* visibility: hidden; */
			/* opacity: 0; */
			/* transition: opacity 0.1s ease-out; */
			
			font-size: 13pt;
		}
		
		.sli-mq-field {
			display: none;
			background: white;
			width: 100%;
			padding: 8px;
		}
		
		.sli-mq-page-shade {
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
			transition: opacity 0.4s cubic-bezier(.22,.61,.36,1);
		}
		`);
		
		// adds elements for the latex dialog into the body
		ctrLatex = insertNodes(document.body, {
			group: [{
				tag: 'div',
				varName: 'mqDialBack',
				id: 'latex-dialog-background',
				classes: [
					'sli-mq-page-shade'
				],
				group : [{
					tag : 'div',
					varName : 'mqContainer',
					classes : [
						'sli-mq-container'
					],
					group : [{
						tag : 'span',
						varName : 'mqField',
						classes : [
							'sli-mq-field'
						]
					}]
				}]
			}]
		});
		
		// captures the span element created by MathQuill
		let catchMQArea = new MutationObserver( obsRec => {
			ctrLatex.mqTextArea = ctrLatex.mqField.getElementsByTagName('textarea')[0];
			ctrLatex.mqTextArea.setAttribute('tabindex', '-1');
			catchMQArea.disconnect();
		});
		// initialize observer
		catchMQArea.observe(ctrLatex.mqField, {
			childList: true
		});
		
		// initializes tha MathQuill field
		DialLtx.MQ = new MQField(ctrLatex.mqField, () => {
			if (DialLtx.MQ) {
				DialLtx.result.value = DialLtx.MQ.mathField.latex();
			}
		});
		
		// adds custom event (to the global object?)
		DialLtx.onChange = new CustomEvent('latexChange', {detail: DialLtx.result});
		
		// hide element DO NOT USE hide()
		ctrLatex.mqDialBack.style.visibility = 'hidden';
		ctrLatex.mqDialBack.style.opacity = '0';
		ctrLatex.mqDialBack.removeChild(ctrLatex.mqContainer);
	}
	
	// DialLtx method definition that shows the latex dialog
	function showLatexDialog(value, coords, dispatcher) {
		DialLtx.dispatcher = dispatcher;
		DialLtx.result.initValue = value || '';
		DialLtx.MQ.mathField.latex(value || '');
		
		ctrLatex.mqDialBack.appendChild(ctrLatex.mqContainer);
		ctrLatex.mqContainer.style.left = `${coords.x}px`;
		ctrLatex.mqContainer.style.top = `${coords.y}px`;
		ctrLatex.mqContainer.style.width = `${coords.width}px`;
		
		ctrLatex.mqDialBack.style.visibility = 'visible';
		ctrLatex.mqDialBack.style.opacity = '1';
		
		ctrLatex.mqTextArea.focus();
	}
	
	// DialLtx method definition that hides the latex dialog
	function hideLatexDialog(result = DialogResult.None) {
		ctrLatex.mqDialBack.style.visibility = 'hidden';
		ctrLatex.mqDialBack.style.opacity = '0';
		ctrLatex.mqDialBack.removeChild(ctrLatex.mqContainer);
		DialLtx.result.action = result;
		DialLtx.dispatcher.dispatchEvent(DialLtx.onChange);
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// GUI Management - Custom Color Picker
	
	// initializes the color picker interface
	function initColorPicker() {
		// insert css styles into existing stylesheet
		appendTextToNode('sli-script-stylesheet',
		`.sli-page-shade{position:fixed;left:0;top:0;width:100%;height:100%;z-index:99;padding:10px;background:rgba(0,0,0,0.4);visibility:hidden;opacity:0;transition:opacity 0.4s cubic-bezier(.22,.61,.36,1)}.sli-dialog-grid{display:grid;grid-template-columns:repeat(2, 2fr 1fr);grid-template-rows:1fr repeat(3, 1fr) repeat(2, 2fr) repeat(3,1fr);padding:8px}.sli-dialog-style{font-family:Arial,Helvetica,sans-serif;font-size:11pt;width:640px;height:480px;background:linear-gradient(#666, #555);position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);box-shadow:2.5px 4.3px 20px 2px rgba(0,0,0,0.5);border:4px solid #1c9969;border-radius:12px}.sli-item-picker{grid-column:1 / 3;grid-row:1 / 7}.sli-item-htmlTextLabel{grid-column:1;grid-row:7}.sli-item-htmlText{grid-column:2;grid-row:7}.sli-item-redText{grid-column:3;grid-row:2}.sli-item-greenText{grid-column:3;grid-row:3}.sli-item-blueText{grid-column:3;grid-row:4}.sli-item-dialOk{grid-column:2 / 3;grid-row:9}.sli-item-dialCancel{grid-column:3 / 4;grid-row:9}.sli-picker-canvas{background:#222;border-radius:100%;margin:auto;border:4px dashed #444}.sli-page-shade label{color:#DDD;margin:auto 4px auto auto;text-shadow:1px 2px 2px rgba(0,0,0,0.5)}.sli-text-box-monospace{font-family:"Lucida Console",Monaco,monospace;height:1.5em;text-align:left;margin:8px auto 8px auto}.sli-text-box-number{font-family:inherit;height:1.5em;text-align:right;margin:8px auto 8px auto}.sli-textbox-style-shadowBlue{border:none;box-shadow:inset 0 0 0 1.25px #ccc, inset 0 0 4px 2px #fff;border-radius:2px;padding:4px 6px 4px 6px;transition:0.2s}.sli-textbox-style-shadowBlue:hover{box-shadow:inset 0 0 0 1.25px #79e7ac, inset 0 0 4px 2px #aaeeca}.sli-textbox-style-shadowBlue:focus{box-shadow:inset 0 0 0 1.25px #b5e3c9, inset 0 0 4px 2px #daf1e4}.sli-textbox-style-shadowBlue:focus:hover{box-shadow:inset 0 0 0 1px #79e7ac, inset 0 0 4px 2px #aaeeca}.sli-textbox-style-shadowBlue-nonactive{border:none;box-shadow:inset 0 0 0 1.25px #ccc, inset 0 0 4px 2px #fff;border-radius:2px;padding:4px 6px 4px 6px;transition:0.2s}.sli-textbox-style-shadowBlue-nonactive:hover{box-shadow:inset 0 0 0 1.25px #b5e3c9, inset 0 0 4px 2px #daf1e4}.sli-textbox-style-shadowBlue-nonactive:focus{box-shadow:inset 0 0 0 1.25px #b5e3c9, inset 0 0 4px 2px #daf1e4}.button-size{font-family:inherit;font-size:1em;margin-top:8px;margin-bottom:8px;margin-left:8px;margin-right:8px;width:5em;height:2em}.sli-button-style-shadowGreen{font-family:inherit;border:none;color:black;background-color:#c6c6c6;background-size:100% 100%;border-radius:5px;border:1px solid #505050;transition:0.2s}.sli-button-style-shadowGreen:hover{border:1px solid #055633;background-color:#17ad6c;box-shadow:0 2px 6px 0 rgba(0,0,0,0.12), 0 6px 8px 0 rgba(0,0,0,0.10)}.sli-button-style-shadowGreen:focus{background-color:#17ad6c;box-shadow:0 1px 2px 0 rgba(0,0,0,0.12), 0 1px 2px 0 rgba(0,0,0,0.10)}.sli-button-style-shadowGreen:focus:hover{background-color:#17ad6c;box-shadow:0 2px 6px 0 rgba(0,0,0,0.12), 0 6px 8px 0 rgba(0,0,0,0.10)}.sli-button-style-shadowGreen:focus:active{background-color:#0c7f4d;transition:0.1s;box-shadow:0 2px 2px 0 rgba(0,0,0,0.12), 0 3px 4px 0 rgba(0,0,0,0.10)}.sli-button-style-shadowRed{font-family:inherit;border:none;color:black;background-color:#c6c6c6;background-size:100% 100%;border-radius:5px;border:1px solid #505050;transition:0.2s}.sli-button-style-shadowRed:hover{background-color:#fb685e;border:1px solid #bd2d00;box-shadow:0 2px 6px 0 rgba(0,0,0,0.12), 0 6px 8px 0 rgba(0,0,0,0.10)}.sli-button-style-shadowRed:focus{background-color:#fb685e;box-shadow:0 1px 2px 0 rgba(0,0,0,0.12), 0 1px 2px 0 rgba(0,0,0,0.10)}.sli-button-style-shadowRed:focus:hover{background-color:#fb685e;box-shadow:0 2px 6px 0 rgba(0,0,0,0.12), 0 6px 8px 0 rgba(0,0,0,0.10)}.sli-button-style-shadowRed:focus:active{background-color:#dc3844;transition:0.1s;box-shadow:0 2px 2px 0 rgba(0,0,0,0.12), 0 3px 4px 0 rgba(0,0,0,0.10)}`);
		
		// adds elements for the color picker into the body
		ctrPicker = insertNodes(document.body, {
			group: [{
				tag: 'div',
				varName: 'background',
				classes: [
					'sli-page-shade'
				],
				group: [{
					tag: 'div',
					varName: 'dialFrame',
					classes: [
						'sli-dialog-style',
						'sli-dialog-grid'
					],
					group: [{
						tag: 'canvas',
						varName: 'colorWheel',
						nodeContent: "This browser doesn't support HTML5",
						attributes: [
							{name: 'width', value: CANV_SIZE + 'px'},
							{name: 'height', value: CANV_SIZE + 'px'}
						],
						classes: [
							'sli-picker-canvas',
							'sli-item-picker'
						]
					}, {
						tag : 'label',
						varName : 'hexColorTextLabel',
						nodeContent: 'Hex:',
						attributes: [
							{name: 'for', value : 'hexColorText'}
						],
						classes: [
							'sli-item-htmlTextLabel'
						]
					}, {
						tag: 'input',
						varName: 'hexColorText',
						attributes: [
							{name: 'type', value: 'text'},
							{name: 'size', value: '12'}
						],
						classes: [
							'sli-text-box-monospace',
							'sli-textbox-style-shadowBlue',
							'sli-item-htmlText'
						]
					}, {
						tag: 'input',
						varName: 'redText',
						attributes: [
							{name: 'type', value: 'text'},
							{name: 'size', value: '6'}
						],
						classes: [
							'sli-text-box-number',
							'sli-textbox-style-shadowBlue',
							'sli-item-redText'
						]
					}, {
						tag: 'input',
						varName: 'greenText',
						attributes: [
							{name: 'type', value: 'text'},
							{name: 'size', value: '6'}
						],
						classes: [
							'sli-text-box-number',
							'sli-textbox-style-shadowBlue',
							'sli-item-greenText'
						]
					}, {
						tag: 'input',
						varName: 'blueText',
						attributes: [
							{name: 'type', value: 'text'},
							{name: 'size', value: '6'}
						],
						classes: [
							'sli-text-box-number',
							'sli-textbox-style-shadowBlue',
							'sli-item-blueText'
						]
					}, {
						tag: 'button',
						varName: 'dialOk',
						nodeContent: '✔️',
						classes: [
							'button-size',
							'sli-button-style-shadowGreen',
							'sli-item-dialOk'
						]
					}, {
						tag: 'button',
						varName: 'dialCancel',
						nodeContent: '❌',
						classes: [
							'button-size',
							'sli-button-style-shadowRed',
							'sli-item-dialCancel'
						]
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
	function showColorWheel(rgbpack, dispatcher) {
		CPicker.dispatcher = dispatcher;
		CPicker.value = 0;
		
		ctrPicker.background.style.visibility = 'visible';
		ctrPicker.background.style.opacity = '1';
		ctrPicker.hexColorText.focus();
		
		updateColorWheel();
	}
	
	// CPicker method definition that hides the color picker
	function hideColorWheel() {
		ctrPicker.background.style.visibility = 'hidden';
		ctrPicker.background.style.opacity = '0';
		
		CPicker.dispatcher.dispatchEvent(CPicker.onChange);
	}
	
	// renders the color wheel onto the canvas
	function updateColorWheel() {
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
			CPicker.value*RAD_TO_DEG, 1, 1
		).map(
			item => item * 255
		);
		
		let triData = drawTriangle(ctx, CPicker.value, triagColor);
		// drawMarkers();
		
		return triData;
	}
	
	// generates data image of a chromatic circle
	function getRainbowRing(img, wdt) {
		let x, y;
		let pix;
		
		for (let i = 0; i < img.length; i += 4) {
			//locData.x = i % wdt;
			//locData.y = (i / wdt|0);
			x = (i/4) % wdt - CANV_MID;
			y = ((i/4) / wdt|0) - CANV_MID; // pipe used to convert operation to integer
			
			pix = getRGBfromHSV(
				Math.atan2(-y, x)*RAD_TO_DEG, 1, 1
			).map(
				item => item * 255
			);
			
			img[i]     = pix[0];
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
				x: n.x * TRIAG_RAD,
				y: n.y * TRIAG_RAD
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
		
		ctrColor.colorButton.addEventListener('click', (e) => {
			CPicker.show(null, ctrColor.colorButton);
			//getCurrentColor()
			//CPicker.show(ActiveItem.expression.);
		});
		
		// event that triggers when user selects a color from color picker
		ctrColor.colorButton.addEventListener('pickerChange', (e) => {
			// setExprColor(ActiveItem.expression, e.target.value);
			console.log(e.detail);
		});
		
		// event that triggers when user clicks opacity button
		ctrColor.opacityButton.addEventListener('click', (e) => {
			let expr = getStateExpr(ActiveItem.expression.index);
			let elemBound = ActiveItem.expression.elem.getBoundingClientRect();
			DialLtx.show(
				expr.stringFillOpacity,
				{x: elemBound.right, y: elemBound.top, width: 400},
				ctrColor.opacityButton
			);
		});
		
		// event that triggers when the opacity dialog is closed
		ctrColor.opacityButton.addEventListener('latexChange', (e) => {
			// change opacity
			if (
				e.detail.action === DialogResult.OK &&
				e.detail.changed()
			) {
				setExprProp(ActiveItem.expression.id, {
					key: 'fillOpacity',
					value: e.detail.value
				});
			}
		});
		
		// event that triggers when user clicks line width button
		ctrColor.widthButton.addEventListener('click', (e) => {
			let elemBound = ActiveItem.expression.elem.getBoundingClientRect();
			let expr = getStateExpr(ActiveItem.expression.index);
			DialLtx.show(
				expr.lineWidth,
				{x: elemBound.right, y: elemBound.top, width: 400},
				ctrColor.widthButton
			);
		});
		
		// event that triggers when the line width dialog is closed
		ctrColor.widthButton.addEventListener('latexChange', (e) => {
			// change line width
			if (
				e.detail.action === DialogResult.OK &&
				e.detail.changed()
			) {
				setStateProp(ActiveItem.expression.index, {
					key: 'lineWidth',
					value: e.detail.value
				});
			}
		});
		
	}
	
	// adds event listeners of the latex dialog
	function loadDialogListeners() {
		// DialLtx.onChange
		ctrLatex.mqDialBack.addEventListener('mousedown', () => {
			if (DialLtx.mseState === MseDial.NORMAL_STATE) {
				DialLtx.mseState = MseDial.EXIT_STATE;
			}
		});
		
		// Release click on gray area
		ctrLatex.mqDialBack.addEventListener('mouseup', () => {
			if (DialLtx.mseState === MseDial.EXIT_STATE) {
				DialLtx.hide(DialogResult.OK);
			}
			DialLtx.mseState = MseDial.NORMAL_STATE;
		});
		
		// prevent keyboard shortcuts from reaching Desmos GUI
		ctrLatex.mqDialBack.addEventListener('keydown', (e) => {
			e.stopPropagation();
		});
		
		// prevent keyboard shortcuts from reaching Desmos GUI
		ctrLatex.mqDialBack.addEventListener('keyup', (e) => {
			e.stopPropagation();
		});
		
		// Release key on latex field
		ctrLatex.mqField.addEventListener('keyup', (e) => {
			switch (true) {
				case e.key === 'Escape':
					DialLtx.hide(DialogResult.Cancel);
					break;
				case e.key === 'Enter':
					DialLtx.hide(DialogResult.OK);
					break;
				default:
					
			}
		});
		
		// Press click on latex field
		bindListenerToNodes([
			ctrLatex.mqField,
			ctrLatex.mqContainer
		], 'mousedown', (e) => {
			DialLtx.mseState = MseDial.SELECT_STATE;
		});
		
		// Release key on latex field
		bindListenerToNodes([
			ctrLatex.mqField,
			ctrLatex.mqContainer
		], 'mouseup', (e) => {
			DialLtx.mseState = MseDial.NORMAL_STATE;
		});
	}
	
	// adds events listeners of the color picker
	function loadColorPickerListeners() {
		// prevent keyboard shortcuts from reaching Desmos GUI
		ctrPicker.background.addEventListener('keydown', (e) => {
			e.stopPropagation();
			return false;
		});
		
		// prevent keyboard shortcuts from reaching Desmos GUI
		ctrPicker.background.addEventListener('keyup', (e) => {
			e.stopPropagation();
			return false;
		});
		
		ctrPicker.dialOk.addEventListener('click', () => {
			CPicker.result.action = DialogResult.OK;
			CPicker.hide();
		});
		
		ctrPicker.dialCancel.addEventListener('click', () => {
			CPicker.result.action = DialogResult.Cancel;
			CPicker.hide();
		});
		
		ctrPicker.colorWheel.addEventListener('mousedown', mouseEventOnWheel);
		ctrPicker.colorWheel.addEventListener('mousemove', mouseEventOnWheel);
		
		// common function for mouse down and mouse move
		function mouseEventOnWheel(e) {
			if (e.buttons === 1) {
				let mse = getCanvasMse(ctrPicker.colorWheel, e);
				CPicker.value = Math.atan2(
					-mse.y + CANV_MID + CPicker.canvasOffset.x,
					mse.x - CANV_MID - CPicker.canvasOffset.y
				);
				updateColorWheel();
			}
		}
		
		// gets the mouse location of an element (including border)
		function getCanvasMse(canvas, evt) {
			var rect = canvas.getBoundingClientRect();
			return {
				x: evt.clientX - rect.left,
				y: evt.clientY - rect.top
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
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// Desmos Helper Functions
	
	// returns the corresponding index for a given id of an expression
	function getExprIndex(id) {
		let exprs = Calc.getExpressions();
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
			case /hsla?/.test(clFrom) && /rgba?/.test(clTo):
				convFunc = getRGBfromHSL;
				rxAlpha = /[a-z]{3}a/;
				break;
			case /hsla?/.test(clFrom) && /hs[vb]a?/.test(clTo):
				convFunc = getHSVfromHSL;
				rxAlpha = /[a-z]{3}a/;
				break;
			case /hs[vb]a?/.test(clFrom) && /rgba?/.test(clTo):
				convFunc = getRGBfromHSV;
				rxAlpha = /[a-z]{3}a/;
				break;
			default:
				throw new CustomError('Argument error', `There is no conversion between ${clFrom} and ${clTo}`);
		}
		
		// bitfield to decide what to do with alpha disparity
		let aBf = (rxAlpha.test(clFrom) ? 1 : 0) | (rxAlpha.test(clTo) ? 2 : 0);
		
		switch (aBf) {
			case 0: // none to none
				return (args) => convFunc(...args);
			case 1: // alpha to none
				return (args) => {args.pop(); return convFunc(...args);};
			case 2: // none to alpha
				return (args) => {return convFunc(...args).concat(1);};
			case 3: // alpha to alpha
				return (args) => {let al = args.pop(); return convFunc(...args).concat(al);};
			default:
				throw new CustomError('Unknown error', `The bitfield has a value of ${aBf}. What kind of sorcery is this?`);
		}
	}
	
	// returns an array with RGB values from an HSL color space
	function getRGBfromHSL(hue, sat, light) {
		const mod = (n, m) => (n * m > 0 ? n % m : n % m + m);
		let ls_ratio = Math.min(light, 1 - light)*sat;
		
		return [0, 8, 4].map((offset, i) => {
			return mod((offset + hue/30), 12);
		}).map((kval, i) => {
			return light - ls_ratio*Math.max(Math.min(Math.min(kval - 3, 9 - kval), 1), -1);
		});
	}
	
	// returns an array with RGB values from an HSV color space
	function getRGBfromHSV(hue, sat, value) {
		const mod = (n, m) => (n * m > 0 ? n % m : n % m + m);
		const RGB_MAX = 255;
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
				break;
			case 6:
				output = hex.match(/(..)(..)(..)/).splice(1);
				break;
			case 4:
				output = hex.match(/(.)(.)(.)(.)/).splice(1);
				break;
			case 8:
				output = hex.match(/(..)(..)(..)(..)/).splice(1);
				break;
			default:
				throw new CustomError('Argument error', `${value} is not a valid CSS hex color`);
		}
		
		if (numeric) {
			output = output.map((item, i) => {
				return Number(`0x${output}`);
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
	
	// returns a 6-digit hex of any given CSS color
	function getHex6(cssColor) {
		let output;
		
		// try if cssColor is a named color
		try {
			output = parseNamedColor(cssColor);
			return output;
		} catch (e) {
			
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
			
			return `#${output.join('')}`;
		} catch (e) {
			console.error(`${e.name}:${e.message}`);
		} finally {
			return '#7F7F7F';
		}
		
	}
	
	// prints something cool into the console :)
	function printSplash() {
		console.log('Custom art tools were loaded properly');
		console.log('written by\n _____ _ _          ______                            \n/  ___| (_)         | ___ \\                           \n\\ `--.| |_ _ __ ___ | |_/ /   _ _ __  _ __   ___ _ __ \n `--. \\ | | \'_ ` _ \\|    / | | | \'_ \\| \'_ \\ / _ \\ \'__|\n/\\__/ / | | | | | | | |\\ \\ |_| | | | | | | |  __/ |   \n\\____/|_|_|_| |_| |_\\_| \\_\\__,_|_| |_|_| |_|\\___|_|   \n                                                      \n                                                      ');
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// User-Script Initialization
	
	// iife that checks if Desmos has finished loading (10 attempts)
	(function loadCheck () {
		if (typeof loadCheck.attempts === 'undefined') {
			loadCheck.attempts = 0;
		} else {
			loadCheck.attempts++;
		}
		
		if (
			typeof window.wrappedJSObject.Calc === 'undefined' ||
			typeof window.wrappedJSObject.Desmos === 'undefined'
		) {
			
			if (loadCheck.attempts < 10) {
				console.log('Desmos is loading...');
				window.setTimeout(loadCheck, 1000);
			} else {
				console.warn("Abort: Art tools script could not load :(");
			}
			
		} else {
			Calc = window.wrappedJSObject.Calc;
			Desmos = window.wrappedJSObject.Desmos;
			console.log('Desmos is ready ✔️');
			
			try {
				initGUI();
				initLatexDialog();
				initColorPicker();
				loadEvents();
				loadDialogListeners();
				loadColorPickerListeners();
				printSplash();
			} catch (ex) {
				console.error(`${ex.name}: ${ex.message}`);
				console.log('An error was encountered while loading');
			} finally {
				// Nothing to do here yet...
			}
			
		}
	} ());
	
} ());
