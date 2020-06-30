// ==UserScript==
// @name     	DesmosTableTools
// @namespace	slidav.Desmos
// @version  	1.0.1
// @author		SlimRunner (David Flores)
// @description	Adds tools to manipulate tables
// @grant    	none
// @match			https://*.desmos.com/calculator*
// @downloadURL	https://gist.github.com/SlimRunner/0652e5d9bae31ec679b369393207ee0f/raw/dgc-table-tools.user.js
// @updateURL	https://gist.github.com/SlimRunner/0652e5d9bae31ec679b369393207ee0f/raw/dgc-table-tools.user.js
// ==/UserScript==

// Global variables imported from host (initialized in loadCheck)
var Calc;
var Desmos;

/***************************************************************************/
// VERTEX ADDER OBJECT

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
				e.altKey &&
				e.buttons === 1
			) {
				
				let expr = Calc.getExpressions()[VtxAdder.getIndex()];
				let x, y;
				
				if (e.ctrlKey) {
					[x, y] = getClosingVertex(expr);
					addVertex(expr, x, y);
					addVertex(expr, '\\infty', '\\infty');
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
			let prevLoc = expr.columns[0].values.lastIndexOf('\\infty') + 1;
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
	
	const guiCSS = {
		controls : [{
			name : 'style',
			id : 'penStyleSheet',
			attributes : [
				{name: 'type', value: 'text/css'}
			],
			textContent : `
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
	};
	
	// dcg-btn-flat-gray
	const guiElements = {
		controls : [{
			name : 'div',
			id : 'drawerToggle',
			classes : [
				'sli-dtt-expr-button',
				'dcg-btn-flat-gray',
				'sli-dtt-table-dcg-icon-align'
			],
			controls : [{
				name : 'i',
				id : 'drawerToggleIcon',
				classes : [
					'dcg-icon-chevron-right'
				]
			}]
		}, {
			name : 'div',
			id : 'drawerTableMenu',
			classes : [
				'sli-dtt-draw-menu',
				'dcg-options-menu'
			],
			attributes : [
				{name : 'tabindex', value : '-1'}
			],
			controls : [{
				name : 'div',
				id : 'bindToggle',
				classes : [
					'sli-dtt-drawer-button',
					'dcg-btn-flat-gray',
					'sli-dtt-table-dcg-icon-align'
				],
				controls : [{
					name : 'i',
					id : 'bindToggleIcon',
					classes : [
						'dcg-icon-cursor'
					]
				}]
			}, {
				name : 'div',
				id : 'addPolyButton',
				attributes: [
					{name: 'title', value: 'Opacity'}
				],
				classes : [
					'sli-dtt-drawer-button',
					'dcg-btn-flat-gray',
					'sli-dtt-table-dcg-icon-align'
				],
				controls : [{
					name : 'i',
					id : 'addPolyButtonIcon',
					classes : [
						'dcg-icon-lines-solid'
					]
				}]
			}]
		}]
	};
	
	// initializes arrays to hold the DOM objects (controls and stylesheet)
	let styleNode = [];
	let ctNodes = [];
	
	// adds a stylesheet to the head element
	insertNodes(guiCSS, document.head, styleNode);
	// furnishes the control list and also adds the elements to the DOM
	insertNodes(guiElements, document.body, ctNodes);
	
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
					hoverExprIdx = getExprIndex(expid[0])
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
		if (VtxAdder.getIndex() === -1) {
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
	let exprs = Calc.getExpressions();
	return exprs.findIndex((elem) => {
		return elem.id === id;
	});
}
// !getExprIndex ()


//parses a custom made JSON object into DOM objects with their properties set up
function insertNodes(jsonTree, parentNode, outControls) {
	for (let item of jsonTree.controls) {
		outControls[item.id] = document.createElement(item.name);
		outControls[item.id].setAttribute('id', item.id);
		parentNode.appendChild(outControls[item.id]);
		
		if (item.hasOwnProperty('classes')) {
			item.classes.forEach(elem => outControls[item.id].classList.add(elem));
		}
		
		if (item.hasOwnProperty('styles')) {
			Object.assign(outControls[item.id].style, item.styles);
		}
		
		if (item.hasOwnProperty('attributes')) {
			item.attributes.forEach(elem => outControls[item.id].setAttribute(elem.name, elem.value));
		}
		
		if (item.hasOwnProperty('textContent')) {
			outControls[item.id].innerHTML = item.textContent;
		}
		
		if (item.hasOwnProperty('controls')) {
			insertNodes(item, outControls[item.id], outControls);
		}
		
	} // !for
	
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
	
	if (typeof this.attempts === 'undefined') {
		this.attempts = 0;
	} else {
		this.attempts++;
	}
	
	if (
		typeof window.wrappedJSObject.Calc === 'undefined' ||
		typeof window.wrappedJSObject.Desmos === 'undefined'
	) {
		
		if (this.attempts < 10) {
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
