// ==UserScript==
// @name     	DesmosArtTools
// @namespace	slidav.Desmos
// @version  	1.2.0
// @author		SlimRunner (David Flores)
// @description	Adds a color picker to Desmos
// @grant    	none
// @match			https://*.desmos.com/calculator*
// @downloadURL	https://gist.github.com/SlimRunner/aacc9cea998a3a8da31eae9d487412d7/raw/dgc-art-tools.user.js
// @updateURL	https://gist.github.com/SlimRunner/aacc9cea998a3a8da31eae9d487412d7/raw/dgc-art-tools.user.js
// ==/UserScript==

/*jshint esversion: 6 */

(function() {
	'use strict';
	var Calc;
	var Desmos;
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// Data structures
	
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
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// GUI Management
	
	// store all controls used in the script
	var ctrColor;
	var ctrLatex;
	// store all buttons of the context menu
	var buttonList;

	// store the state of the context menu
	var ActiveItem = Object.assign({}, {
		expression: null,
		element: null,
		menuActive: false,
		menuVisible: false,
		reset: function () {
			ActiveItem.expression = null;
			ActiveItem.element = null;
			ActiveItem.menuActive = false;
			ActiveItem.menuVisible = false;
		}
	});
	
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
				
				/* LATEX DIALOG */
				
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
				`
			}]
		});
		
		// adds elements for the context menu into the body
		ctrColor = insertNodes(document.body, {
			group : [{
				/*****************************/
				tag : 'div',
				varName : 'propMenu',
				id : 'expr-context-menu',
				classes : [
					'sli-prop-menu',
					'dcg-options-menu'
				],
				group : [{
					tag : 'input',
					varName : 'colorButton',
					attributes: [
						{name: 'type', value: 'color'},
						{name: 'title', value: 'Color Picker'}
					],
					classes : [
						'sli-menu-button',
						'dcg-btn-flat-gray'
					]
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
						// varName : 'opacityIcon',
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
						// varName : 'opacityIcon',
						classes : [
							'dcg-icon-pencil'
						]
					}]
				}]
			}]
		});
		
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
					if ( typeof node.getElementsByClassName === 'function' && !isFound) {
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
				type: 'table',
				id: eID,
				colIndex: seekAttribute(expElem, cellQuery, 'index'),
				index: getExprIndex(eID)
			};
		} else if (expElem = document.querySelector(expressionQuery)) {
			let eID = expElem.getAttribute('expr-id');
			// this is an expression
			return {
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
		return stExpr.type === 'expression' &&
			(
				stExpr.fill === true ||
				stExpr.latex.indexOf('\\operatorname{polygon}') !== -1
			);
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
			
			try {
				ctrColor.colorButton.value = getHex6(getCurrentColor());
			} catch (e) {
				console.log(e.message);
			} finally {
				// nothing to do
			}
			
			// update buttons dynamically while menu is open
			Calc.observeEvent('change', () => {
				// shows button when fill option is enabled
				prepareMenu();
				// updates color when color changes
				ctrColor.colorButton.value = getHex6(getCurrentColor());
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
	
	function getCurrentColor() {
		let expr = getPureExpr(ActiveItem.expression.index);
		
		if (expr.type === 'expression') {
			return expr.color;
			
		} else if (expr.type === 'table') {
			return expr.columns[ActiveItem.expression.colIndex].color;
			
		}
		
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// Event handlers
	
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
		
		// event that triggers when user selects a color from color picker
		ctrColor.colorButton.addEventListener('change', (e) => {
			let expr = Calc.getExpressions()[ActiveItem.expression.index];
			
			switch (true) {
				case expr.type === 'expression':
					Calc.setExpression({
						id: expr.id,
						color: e.target.value
					});
					expr.color = e.target.value;
					break;
				case expr.type === 'table':
					expr.columns[ActiveItem.expression.colIndex].color = e.target.value;
					Calc.setExpression({
						type:'table',
						id: expr.id,
						columns: expr.columns
					});
					break;
				default:
					// not a valid type
			}
		});
		
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
	
	// binds a list of elements to a single callback
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
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// General Helper Functions
	
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
	
	// returns an array containing the name of the CSS funcion and its parameters destructured
	function parseCSSFunc(value) {
		if (typeof value !== 'string') throw new CustomError('Parameter error', 'value is not a valid string');
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
		console.table({funcName, argSet, alpha});
		console.table(args);
		console.table(pType);
		let output;
		
		switch (true) {
			case funcName === 'rgb':
			case funcName === 'rgba':
				if (!isEqual(pType, NUMMAP_RGB)) throw new CustomError('Paremeter error', 'RGB parameters are not valid');
				output = args.map(parseFloat);
				
				break;
			case funcName === 'hsl':
			case funcName === 'hsla':
				if (!isEqual(pType, NUMMAP_HSL)) throw new CustomError('Paremeter error', 'HSL parameters are not valid');
				output = args.map(parseFloat).map((num, i) => {
					return num * (pType[i] ? 0.01 : 1);
				});
				break;
			default:
				throw new CustomError('Paremeter error', `${funcName} is not a recognized CSS function`);
		}
		
		if (typeof alpha !== 'undefined') {
			if (funcName.length === 3) throw new CustomError('Parameter error', `${funcName} function only recieves 3 parameters`);
			output.push(parseFloat(alpha) * (isNaN(alpha) ? 0.01 : 1));
		}
		
		return [funcName].concat(output);
	}
	
	// returns an array containing a desctructured version of a valid CSS hex color
	function parseCSSHex(value, numeric = false) {
		if (typeof value !== 'string') throw new CustomError('Parameter error', 'value is not a valid string');
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
				throw new CustomError('Paremeter error', `${value} is not a valid CSS hex color`);
		}
		
		if (numeric) {
			output = output.map((item, i) => {
				return Number(`0x${output}`);
			});
		}
		
		return output;
	}
	
	// checks if the input is a named CSS color and returns its HEX value
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
	
	// returns any CSS color parsed as 6-digit hex
	function getHex6(cssColor) {
		let output;
		
		try {
			output = parseNamedColor(cssColor);
			return output;
		} catch (e) {
			
		}
		
		try {
			output = parseCSSHex(cssColor);
			
			if (output.length === 4) output.pop();
			
			output.map((item) => {
				return item.length === 1 ? '0' : '' + item;
			});
			
			// pads with 0 if length is not 2
			return `#${output.map((item) => {
				return item.length === 1 ? '0' : '' + item;
			}).join('')}`;
			
		} catch (e) {
			
		}
		
		try {
			output = parseCSSFunc(cssColor);
			console.warn(`${output[0]} color cannot be parsed yet`);
			return '#000000';
		} catch (e) {
			console.error(`${e.name}:${e.message}`);
		}
		
	}
	
	// prints something cool into the console :)
	function printSplash() {
		console.log('Custom art tools were loaded properly');
		console.log('written by\n _____ _ _          ______                            \n/  ___| (_)         | ___ \\                           \n\\ `--.| |_ _ __ ___ | |_/ /   _ _ __  _ __   ___ _ __ \n `--. \\ | | \'_ ` _ \\|    / | | | \'_ \\| \'_ \\ / _ \\ \'__|\n/\\__/ / | | | | | | | |\\ \\ |_| | | | | | | |  __/ |   \n\\____/|_|_|_| |_| |_\\_| \\_\\__,_|_| |_|_| |_|\\___|_|   \n                                                      \n                                                      ');
	}
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// User-Script Initialization
	
	// iife that checks if the Desmos has finished loading (10 attempts)
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
				console.warn("Something went wrong :(");
			}
			
		} else {
			Calc = window.wrappedJSObject.Calc;
			Desmos = window.wrappedJSObject.Desmos;
			console.log('Desmos is ready ✔️');
			
			try {
				initGUI();
				loadEvents();
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
