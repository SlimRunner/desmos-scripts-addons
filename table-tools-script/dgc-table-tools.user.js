// ==UserScript==
// @name     	DesmosTableTools
// @namespace	slidav.Desmos
// @version  	1.0.6
// @author		SlimRunner (David Flores)
// @description	Adds tools to manipulate tables
// @grant    	none
// @match			https://*.desmos.com/calculator*
// @downloadURL	https://github.com/SlimRunner/desmos-scripts-addons/raw/master/table-tools-script/dgc-table-tools.user.js
// @updateURL	https://github.com/SlimRunner/desmos-scripts-addons/raw/master/table-tools-script/dgc-table-tools.user.js
// ==/UserScript==

/*jshint esversion: 6 */

(function() {
	'use strict';
	
	// Global variables imported from host (initialized in loadCheck)
	var Calc;
	var Desmos;
	
	const POLY_CLOSURE = '\\frac{0}{0}';
	
	/***************************************************************************/
	// VERTEX ADDER OBJECT
	
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
	
	let VtxAdder = {};
	
	VtxAdder.Scaling = true;
	
	// List of constants for table states
	VtxAdder.TableState = Object.defineProperties({}, {
		INVALID : {
			value: 0,
			writable: false,
			enumerable: true,
			configurable: true
		},
		
		NO_TRAIL : {
			value: 1,
			writable: false,
			enumerable: true,
			configurable: true
		},
		
		HAS_TRAIL : {
			value: 2,
			writable: false,
			enumerable: true,
			configurable: true
		}
	}); // !TableState defineProperties
	
	
	
	Object.assign(VtxAdder, {
		
		initialize : function () {
			if (typeof VtxAdder.ExprID !== 'undefined') {
				throw Error('Cannot initialize twice');
			}
			
			VtxAdder.ExprID = null;
			let element = (elem => elem[elem.length - 1])(document.getElementsByClassName('dcg-graph-outer'));
			
			element.addEventListener('mousedown', (e) => {
				
				if (
					VtxAdder.getIndex() !== -1 &&
					e.ctrlKey &&
					e.buttons === 1
				) {
					
					let expr = Calc.getExpressions()[VtxAdder.getIndex()];
					let x, y;
					
					if (e.shiftKey) {
						[x, y] = getClosingVertex(expr);
						addVertex(expr, x, y);
						addVertex(expr, POLY_CLOSURE, POLY_CLOSURE);
					} else {
						[x, y] = getGraphMse(e);
						addVertex(expr, x, y);
					} // !if-else
					
				} // !if
				
			}); // !element_mouseup ()
			
			
			let addVertex = (expr, x, y) => {
				let TS = VtxAdder.TableState;
				let lastIdx = expr.columns[0].values.length - 1;
				let canModify = false;
				
				switch (VtxAdder.validateExpression(expr)) {
					case TS.NO_TRAIL:
						expr.columns[0].values.push(x);
						expr.columns[1].values.push(y);
						canModify = true;
						break;
						
					case TS.HAS_TRAIL:
						expr.columns[0].values[lastIdx] = x;
						expr.columns[1].values[lastIdx] = y;
						canModify = true;
						break;
						
					case TS.INVALID:
						//nothing to do
						break;
						
					default:
						//nothing to do
						
				} // !switch
				
				if (canModify) {
					Calc.setExpression(expr);
				}
				
			}; // !addVertex ()
			
			
			let getGraphMse = (e) => {
				let client = element.getBoundingClientRect();
				let graphPix = Calc.graphpaperBounds.pixelCoordinates;
				let graphMath = Calc.graphpaperBounds.mathCoordinates;
				let x, y;
				
				x = (e.x - client.x) / graphPix.width * graphMath.width + graphMath.left;
				y = -(e.y - client.y) / graphPix.height * graphMath.height + graphMath.top;
				
				if (VtxAdder.Scaling) {
					let precision = Math.pow(10, Math.ceil(Math.log10(
						graphPix.width / graphMath.width
					)));
					let round = (val, scl) => Math.round(val * scl) / scl;
					
					x = round(x, precision);
					y = round(y, precision);
				}
				
				return [x, y];
			}; // !getGraphMse ()
			
			
			let getClosingVertex = (expr) => {
				let prevLoc = expr.columns[0].values.lastIndexOf(POLY_CLOSURE) + 1;
				let xCol = expr.columns[0];
				let yCol = expr.columns[1];
				
				return [xCol.values[prevLoc], yCol.values[prevLoc]];
			}; // !getClosingVertex ()
			
		}, // !initialize ()
		
		
		
		bindExpression : function (idx) {
			VtxAdder.ExprID = null;
			
			let expList = Calc.getExpressions();
			
			if ( idx < 0 || idx >= expList.length ) {
				return false;
			}
			
			let expFlag = VtxAdder.validateExpression(expList[idx]);
			if (expFlag === VtxAdder.TableState.INVALID) {
				return false;
			}
			
			VtxAdder.ExprID = expList[idx].id;
			return true;
		}, // !bindExpression ()
		
		
		
		unbindExpression : function () {
			VtxAdder.ExprID = null;
		},
		
		
		
		validateExpression : function (expr) {
			if (expr.type !== 'table'){
				return VtxAdder.TableState.INVALID;
			} // !if
			
			if (expr.columns.length !== 2) {
				return VtxAdder.TableState.INVALID;
			} // !if
				
			let lastIdx = expr.columns[0].values.length;
			
			if (lastIdx !== expr.columns[1].values.length) {
				return VtxAdder.TableState.INVALID;
			} // !if
			
			--lastIdx;
			
			if (
				expr.columns[0].values[lastIdx] &&
				expr.columns[1].values[lastIdx]
			) {
				return VtxAdder.TableState.NO_TRAIL;
			} // !if
			
			return VtxAdder.TableState.HAS_TRAIL;
		}, // !validateExpression ()
		
		
		
		getIndex : function () {
			let calcExpressions = Calc.getExpressions();
			return calcExpressions.findIndex((elem) => {
				return elem.id === VtxAdder.ExprID;
			});
		}, // !getIndex ()
		
		
		
		addPolygon : function () {
			if (VtxAdder.getIndex() !== -1) {
				let expr = Calc.getExpressions()[VtxAdder.getIndex()];
				
				let msg = VtxAdder.validateExpression(expr);
				if (msg === VtxAdder.TableState.INVALID) {
					return false;
				}
				
				let x = expr.columns[0].latex;
				let y = expr.columns[1].latex;
				
				Calc.setExpression({
					latex : `\\operatorname{polygon}\\left(${x},${y}\\right)`
				});
				
			} else {
				return false;
				
			} // !if-else
			
			return true;
		},
		
	}); // !VtxAdder assign
	
	
	/***************************************************************************/
	// MOUSE PEN
	function mousePen() {
		const GUI_GAP = 4;
		
		// adds a stylesheet to the head element
		insertNodes(document.head, {
			group : [{
				tag : 'style',
				id : 'sli-table-stylesheet',
				attributes : [
					{name: 'type', value: 'text/css'}
				],
				nodeContent : `
				.sli-dtt-draw-menu {
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
				
				.sli-dtt-drawer-button {
					background: #ededed;
					padding: 5px;
					width: 38px;
					height: 38px;
				}
				
				.sli-dtt-drawer-button-pressed {
					background: #528fc9;
					webkit-box-shadow:
						inset 0 0 4px 0 rgba(0, 0, 0, 0.4) !important;
					box-shadow:
						inset 0 0 4px 0 rgba(0, 0, 0, 0.4) !important;
				}
				
				.sli-dtt-expr-button {
					background: #ededed;
					display: none;
					border-radius : 100% !important;
					position: fixed;
					left: 0;
					top: 0;
					width: 30px;
					height: 30px;
					z-index: 99;
				}
				
				.sli-dtt-table-dcg-icon-align {
					text-align: center;
					line-height: 2em;
				}
				`
			}]
		});
		
		// furnishes the control list and also adds the elements to the DOM
		let ctNodes = insertNodes(document.body, {
			group : [{
				tag : 'div',
				varName : 'drawerToggle',
				classes : [
					'sli-dtt-expr-button',
					'dcg-btn-flat-gray',
					'sli-dtt-table-dcg-icon-align'
				],
				group : [{
					tag : 'i',
					classes : [
						'dcg-icon-chevron-right'
					]
				}]
			}, {
				tag : 'div',
				varName : 'drawerTableMenu',
				classes : [
					'sli-dtt-draw-menu',
					'dcg-options-menu'
				],
				attributes : [
					{name : 'tabindex', value : '-1'}
				],
				group : [{
					tag : 'div',
					varName : 'bindToggle',
					attributes: [
						{name: 'title', value: 'bind/unbind table'}
					],
					classes : [
						'sli-dtt-drawer-button',
						'dcg-btn-flat-gray',
						'sli-dtt-table-dcg-icon-align'
					],
					group : [{
						tag : 'i',
						classes : [
							'dcg-icon-cursor'
						]
					}]
				}, {
					tag : 'div',
					varName : 'addPolyButton',
					attributes: [
						{name: 'title', value: 'add polygon'}
					],
					classes : [
						'sli-dtt-drawer-button',
						'dcg-btn-flat-gray',
						'sli-dtt-table-dcg-icon-align'
					],
					group : [{
						tag : 'i',
						classes : [
							'dcg-icon-lines-solid'
						]
					}]
				}]
			}]
		});
		
		let panelElem = findExpressionPanel();
		let activeButton = false;
		let activeExprIdx = -1;
		let hoverExprIdx = -1;
		
		panelElem.addEventListener('mousemove', function (e) {
			if (typeof this.onHold === 'undefined') {
				this.onHold = false;
			}
			
			if (!this.onHold) {
				this.onHold = true;
				setTimeout(() => {
					let expid = seekAttribute(panelElem, '.dcg-hovered', 'expr-id');
					if (expid.length >= 1) {
						// check if expression with expid ID is a valid table
						hoverExprIdx = getExprIndex(expid[0]);
						let exprs = Calc.getExpressions()[getExprIndex(expid[0])];
						if (
							VtxAdder.validateExpression(exprs) !==
							VtxAdder.TableState.INVALID
						) {
							let elemExpr = getElementsByAttribute(panelElem, '.dcg-hovered', 'expr-id')[0];
							
							showTableButton(true, elemExpr);
						} else {
							showTableButton(false, null);
						}
						
					} else {
						showTableButton(false, null);
					}
					
					this.onHold = false;
				}, 200);
			}
		}); // !panelElem_mousemove
		
		ctNodes.drawerToggle.addEventListener('mouseenter', () => {
			activeButton = true;
		});
		
		ctNodes.drawerToggle.addEventListener('mouseleave', () => {
			activeButton = false;
		});
		
		ctNodes.drawerToggle.addEventListener('click', () => {
			activeExprIdx = hoverExprIdx;
			let idx = VtxAdder.getIndex();
			let pressed = idx !== -1 && idx === activeExprIdx;
			
			// select a style for bind button depending on whether active expression has or not been bound
			setBindButtonStyle(pressed);
			
			setDrawerLocation(ctNodes.drawerToggle);
			showDrawer(true);
		});
		
		ctNodes.drawerTableMenu.addEventListener('blur', () => {
			showDrawer(false);
		});
		
		ctNodes.bindToggle.addEventListener('click', () => {
			let exprs = Calc.getExpressions()[activeExprIdx];
			
			if (
				VtxAdder.validateExpression(exprs) !==
				VtxAdder.TableState.INVALID &&
				VtxAdder.getIndex() !== activeExprIdx
			) {
				if (!VtxAdder.bindExpression(activeExprIdx)) {
					console.log('there was an error binding expression');
				} else {
					// add some style to the button so that it looks pressed
					setBindButtonStyle(true);
				}
			} else {
				VtxAdder.unbindExpression();
				// remove pressed style from button
				setBindButtonStyle(false);
			}
		});
		
		ctNodes.addPolyButton.addEventListener('click', () => {
			VtxAdder.addPolygon(); // returns false when it can't add polygon
		});
		
		/***************************************************************************/
		// GUI MANAGEMENT
		
		// shows or hides div element with table options
		function showDrawer(show) {
			if (show) {
				refreshDrawerMenu();
				ctNodes.drawerTableMenu.style.visibility = 'visible';
				ctNodes.drawerTableMenu.style.opacity = '1';
				ctNodes.drawerTableMenu.focus();
			} else {
				ctNodes.drawerTableMenu.style.visibility = 'hidden';
				ctNodes.drawerTableMenu.style.opacity = '0';
			}
		}
		
		
		
		// sets location of table-options div element next to the toggle button which is passed as elem
		function setDrawerLocation(elem) {
			let anchor = elem.getBoundingClientRect();
			let btn = ctNodes.drawerToggle.getBoundingClientRect();
			
			let x = anchor.right + GUI_GAP * 2;
			let y = (anchor.top + anchor.bottom - btn.height) / 2;
			
			ctNodes.drawerTableMenu.style.left = `${x}px`;
			ctNodes.drawerTableMenu.style.top = `${y}px`;
		}
		
		
		
		// shows or hides dynamic options within drawer menu
		function refreshDrawerMenu() {
			if (VtxAdder.getIndex() === activeExprIdx) {
				ctNodes.addPolyButton.style.display = 'block';
			} else {
				ctNodes.addPolyButton.style.display = 'none';
			}
			
			// get number of displayed childs
			let elemSize = Math.min(3, Array.from (
				ctNodes.drawerTableMenu.childNodes
			).filter(elem => elem.style.display !== 'none').length);
			
			ctNodes.drawerTableMenu.style.gridTemplateColumns = `repeat(${elemSize}, 1fr)`;
		}
		
		
		
		//
		function setBindButtonStyle(pressed) {
			if (pressed) {
				ctNodes.bindToggle.classList.add('sli-dtt-drawer-button-pressed');
			} else {
				ctNodes.bindToggle.classList.remove('sli-dtt-drawer-button-pressed');
			}
		}
		
		
		
		// shows or hides drawer toggle button. Won't hide when activeButton is true
		function showTableButton(show, elem) {
			if (show) {
				setButtonLocation(elem);
				ctNodes.drawerToggle.style.display = 'block';
			} else {
				if (activeButton) return 0;
				ctNodes.drawerToggle.style.display = 'none';
			}
		}
		
		
		
		// sets location of drawer-toggle button element inside elem
		function setButtonLocation(elem) {
			let mnu = elem.getBoundingClientRect();
			
			let x = mnu.left + GUI_GAP;
			let y = mnu.top + GUI_GAP * 4;
			
			ctNodes.drawerToggle.style.left = `${x}px`;
			ctNodes.drawerToggle.style.top = `${y}px`;
		}
		
		
		/***************************************************************************/
		// DOM MANAGEMENT
		
		// finds element that contains the expressions in Desmos
		function findExpressionPanel() {
			return document.getElementsByClassName(
				"dcg-expressionitem"
			)[0].parentNode;
		}
		// !findExpressionPanel ()
		
	}
	// !mousePen ()
	
	
	/***************************************************************************/
	// HELPER FUNCTIONS

	// Gets the expression index of a given ID within the Calc object
	function getExprIndex (id) {
		let exprs = Calc.getState().expressions.list;
		return exprs.findIndex((elem) => {
			return elem.id === id;
		});
	}
	// !getExprIndex ()
	
	
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
	// !insertNodes ()
	
	
	
	// performs a query on parent and aggregates all found values of a specified attribute
	function seekAttribute(parent, query, attName) {
		let output = [];
		let nodes = parent.querySelectorAll(query);
		
		if (nodes.length > 0) {
			nodes.forEach((node, i) => {
				if (typeof node.getAttributeNames !== 'function') return 0;
				if (node.getAttributeNames().indexOf(attName) !== -1) {
					output.push(node.getAttribute(attName));
				}
			});
			
		}
		
		return output;
	}
	// !seekAttribute ()
	
	
	
	// performs a query on parent and aggregates all found nodes that have the specified attribute (attName)
	function getElementsByAttribute(parent, query, attName) {
		let output = [];
		let nodes = parent.querySelectorAll(query);
		
		if (nodes.length > 0) {
			nodes.forEach((node, i) => {
				if (typeof node.getAttribute !== 'function') return 0;
				if (node.getAttributeNames().indexOf(attName) !== -1) {
					output.push(node);
				} 
			});
			
		}
		
		return output;
	}
	// !getElementsByAttribute ()
	
	
	/***************************************************************************/
	// SCRIPT INITIALIZATION
	
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
				window.setTimeout(loadCheck, 1000);
			} else {
				console.log("Abort: The script couldn't load properly :/");
			}
			
		} else {
			Calc = window.wrappedJSObject.Calc;
			Desmos = window.wrappedJSObject.Desmos;
			// INITIALIZE STUFF HERE
			VtxAdder.initialize();
			mousePen();
			console.log('Desmos Table Tools were loaded properly');
		}
	})();
	
}());
