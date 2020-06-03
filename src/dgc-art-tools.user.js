// ==UserScript==
// @name     	DesmosArtTools
// @namespace	slidav.Desmos
// @version  	1.0
// @author		SlimRunner (David Flores)
// @description	Adds a color picker to Desmos
// @grant    	none
// @match			https://*.desmos.com/calculator*
// ==/UserScript==

var Calc;

(function loadCheck () {
	if (typeof window.wrappedJSObject.Calc === 'undefined') {
		console.log('Calc is not defined');
		window.setTimeout(loadCheck, 1000);
		
		// TODO: Add a counter that stops the script if certain failed attemts are reached
	} else {
		Calc = window.wrappedJSObject.Calc;
		console.log('Calc is defined');
		colorPicker();
		console.log('Custom color picker has been loaded');
		console.log('written by\n _____ _ _          ______                            \n/  ___| (_)         | ___ \\                           \n\\ `--.| |_ _ __ ___ | |_/ /   _ _ __  _ __   ___ _ __ \n `--. \\ | | \'_ ` _ \\|    / | | | \'_ \\| \'_ \\ / _ \\ \'__|\n/\\__/ / | | | | | | | |\\ \\ |_| | | | | | | |  __/ |   \n\\____/|_|_|_| |_| |_\\_| \\_\\__,_|_| |_|_| |_|\\___|_|   \n                                                      \n                                                      ');
	}
})();

function colorPicker () {
	/***************************************************************************/
	// DATA AND OBJECTS

	//Object tree of stylesheet
	const guiCSS = {
		controls : [{
			name : 'style',
			id : 'customSheet',
			attributes : [
				{name: 'type', value: 'text/css'}
			],
			textContent : '.sli-color-button{background:#ededed;padding:5px;position:fixed;left:0;top:0;width:38px;height:38px;z-index:99;visibility:hidden;opacity:0;transition:opacity 0.1s ease-out}'
		}]
	}

	// Object tree of GUI elements
	const guiElements = {
		controls : [{
			name : 'input',
			id : 'colorButton',
			attributes: [
				{name: 'type', value: 'color'}
			],
			classes : [
				'sli-color-button',
				'dcg-btn-flat-gray'
			]
		}]
	}

	/***************************************************************************/
	// GUI MANAGEMENT

	const GUI_GAP = 8;

	let styleNode = [];
	// adds a stylesheet to the head element
	insertNodes(guiCSS, document.head, styleNode);

	// initializes an array to hold the DOM objects (controls)
	let ctrlNodes = [];
	// furnishes the control list and also adds the elements to the DOM
	insertNodes(guiElements, document.body, ctrlNodes);

	let currMenuItem = null;
	let currMenuElement = null;
	let colButtonActive = false;
	let colMenuActive = false;

	// callback that executes when the color menu shows up
	hookMenu( (itemElem, expItem, isFound) => {
		
		colMenuActive = isFound;
		
		if (isFound) {
			currMenuItem = expItem;
			currMenuElement = itemElem;
			setButtonLocation();
		}
		
		if (!colButtonActive) {
			showButton(isFound);
		}
		
	});
	
	// hides button when menu is gone and the mouse left the button client area
	ctrlNodes.colorButton.addEventListener('mouseleave', () => {
		if (!colMenuActive) {
			colButtonActive = false;
			showButton(false);
		}
		
	});
	
	// changes button state to active so that button doesn't go away with menu
	ctrlNodes.colorButton.addEventListener('mousedown', () => {
		colButtonActive = true;
	});
	
	// performs click changes button state to false and hides button
	ctrlNodes.colorButton.addEventListener('click', () => {
		colButtonActive = false;
		showButton(false);
	});
	
	// event that triggers when user selects a color from color picker
	ctrlNodes.colorButton.addEventListener('change', () => {
		if (currMenuItem.type === 'expression') {
			Calc.setExpression({
				id: currMenuItem.id,
				color: ctrlNodes.colorButton.value
			});
		} else if (currMenuItem.type === 'table') {
			let expr = Calc.getExpressions();
			
			expr[getCurrentIndex()].columns[currMenuItem.colIndex].color = ctrlNodes.colorButton.value;
			
			Calc.setExpression({
				type:'table',
				id: currMenuItem.id,
				columns: expr[getCurrentIndex()].columns
			});
		}
		
	});

	/***************************************************************************/
	// GUI MANAGEMENT

	// shows or hides button to access custom properties
	function showButton(value) {
		if (value) {
			ctrlNodes.colorButton.style.visibility = 'visible';
			ctrlNodes.colorButton.style.opacity = '1';
			ctrlNodes.colorButton.value = getCurrentColor();
		} else {
			ctrlNodes.colorButton.style.visibility = 'hidden';
			ctrlNodes.colorButton.style.opacity = '0';
		}
	} // !showButton ()

	function setButtonLocation() {
		let mnu = currMenuElement.getBoundingClientRect();
		let btn = ctrlNodes.colorButton.getBoundingClientRect();
		
		let x = (mnu.right + GUI_GAP);
		let y = (mnu.bottom - (mnu.height + btn.height) / 2);
		
		ctrlNodes.colorButton.style.left = `${x}px`;
		ctrlNodes.colorButton.style.top = `${y}px`;
	} // !setButtonLocation ()

	//returns true if the index references a valid expression type item and the color is a valid HTML hex color
	function validateData(index, color) {
		let tempState = Calc.getState();

		if (isNaN(index))
			return false;
		if (index < 0 || index >= tempState.expressions.list.length)
			return false;

		let item = tempState.expressions.list[index];

		if (item.hasOwnProperty('type')) {
			if (item.type === 'expression') {
				let hexColRegex = /^#[A-Fa-f0-9]{6}$|^#[A-Fa-f0-9]{3}$/m;
				if (hexColRegex.test(color)) {
					return true;
				}
			} else {
				console.log(`no need to change colors of items of ${item.type} type`);
			}
		}

		return false;
	} // !validateData ()

	/***************************************************************************/
	// DOM MANAGEMENT

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
		
	} // !insertNodes ()
	
	// calls provided callback whenever an expression menu in Desmos is deployed
	function hookMenu(callback) {
		// initializes observer
		let menuObserver = new MutationObserver( obsRec => {
			let idx = 0;
			let menuElem;
			let isFound = false;
			
			const ITEM_TABLE = 0, ITEM_EXPRESSION = 1;
			
			// repeats search until sought item is found in the list of addedNodes
			do {
				if (obsRec[idx].addedNodes.length > 0) {
					obsRec[idx].addedNodes.forEach((item, i) => {
						if (typeof item.getElementsByClassName === 'function') {
							let menuColumn = item.getElementsByClassName('dcg-options-menu-column-left');
							
							if (menuColumn.length !== 0) {
								menuElem = menuColumn[0].parentNode;
								isFound = true;
							}
							
						} // !if
						
					}); // !forEach
					
				} // !if
				++idx;
			} while (idx < obsRec.length && !isFound);
			
			let expItem = {};
			
			// if an item was found then finds appropriate values for expItem
			if (isFound) {
				let expElem = { length: 0 };
				let expType, expId, expCell;
				
				let typeIdx = -1;
				// list of queries to determine the type of the element (table/regular)
				const seekList = ['.dcg-expressionitem.dcg-expressiontable.dcg-depressed,.dcg-expressionitem.dcg-expressiontable.dcg-hovered', '.dcg-expressionitem.dcg-depressed,.dcg-expressionitem.dcg-hovered'];
				
				// traverse seekList to find fitting element container
				seekList.forEach((query, i) => {
					if (expElem.length === 0) {
						expElem = document.querySelectorAll(query);
						
						typeIdx = i;
					}
					
				});
				
				// furnishes expItem depending on the type of the expression
				switch (typeIdx) {
					case ITEM_TABLE:
						expType = 'table';
						expId = expElem[0].getAttribute('expr-id');
						expCell = seekAttribute(expElem[0], '.dcg-cell.dcg-depressed,.dcg-cell.dcg-hovered', 'index')[0];
						
						expItem = {
							type: expType,
							id: expId.toString(),
							colIndex: expCell
						};
						
						break;
					case ITEM_EXPRESSION:
						expType = 'expression';
						expId = expElem[0].getAttribute('expr-id');
						
						expItem = {
							type: expType,
							id: expId.toString()
						};
						
						break;
					default:
						
				} // !switch
				
			} // if (isFound)
			
			callback(menuElem, expItem, isFound);
			
		}); // !MutationObserver
		
		let menuContainer = findOptionsMenu();
		
		if (menuContainer !== null) {	
			menuObserver.observe(menuContainer, {
				childList: true
			});
			
		} else {
			console.log('couldn\'t find menu container');
			
		}
		
	} // !hookMenu ()

	function getCurrentIndex () {
		let calcExpressions = Calc.getExpressions();
		return calcExpressions.findIndex((elem) => {
			return elem.id === currMenuItem.id;
		});
	} // !getCurrentIndex ()

	function getCurrentColor() {
		let calcExpressions = Calc.getExpressions();
		let index = calcExpressions.findIndex((elem) => {
			return elem.id === currMenuItem.id;
		});
		
		if (currMenuItem.type === 'expression') {
			return calcExpressions[index].color;
			
		} else if (currMenuItem.type === 'table') {
			let expr = Calc.getExpressions();
			
			return calcExpressions[index].columns[currMenuItem.colIndex].color;
		}
		
	} // !getCurrentColor ()

	// finds element that contains the color menu in Desmos
	function findOptionsMenu() {
		
		let targetChild = document.getElementsByClassName('dcg-exppanel-outer');
		
		if (targetChild.length == 1) {
			return targetChild[0].parentNode;
			
		} else {
			return null;
			
		}
	} // !findOptionsMenu ()

	// performs a css query on an element and aggregates all found values of a specified attribute
	function seekAttribute(parent, query, attName) {
		let output = [];
		let nodes = parent.querySelectorAll(query);
		
		if (nodes.length > 0) {
			nodes.forEach((node, i) => {
				if (typeof node.getAttributeNames === 'function') {
					if (node.getAttributeNames().indexOf(attName)) {
						output.push(node.getAttribute(attName));
					}
				}
			});
			
		}
		
		return output;
	} // !seekAttribute ()
	
} // !colorPicker ()
