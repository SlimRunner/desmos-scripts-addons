/*
 * Author: SlimRunner
 *
 * Console script to help change colors of individual graphs easily
 *
*/

(function () {
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
			textContent : '.sli-hidden-dial {position: absolute; left: -10000px; top: auto; width: 1px; height: 1px; overflow: hidden;} .sli-color-button {background:#ededed;position:fixed;left:0;top:0;width:38px;height:38px;z-index:99;visibility:hidden;opacity:0;transition:opacity 0.1s ease-out}'
		}]
	}

	// Object tree of GUI elements
	const guiElements = {
		controls : [{
			name : 'div',
			id : 'colorButton',
			classes : [
				'dcg-btn-flat-gray',
				'dcg-settings-pillbox',
				'dcg-action-settings',
				'sli-color-button'
			],
			controls : [{
				name : 'i',
				id : 'btnIcon',
				classes : [
					'dcg-icon-magic'
				]
			}]
		}, {
			name: 'input',
			id: 'colorDial',
			attributes: [
				{name: 'type', value: 'color'}
			],
			classes: [
				'sli-hidden-dial'
			]
		}]
	}

	/***************************************************************************/
	//MAIN CODE

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

	hookMenu( (itemElem, expItem, isFound) => {
		if (isFound) {
			currMenuItem = expItem;
			currMenuElement = itemElem;
			setButtonLocation();
		}
		
		showButton(isFound);
		
	});

	// colorButton click event
	ctrlNodes.colorButton.addEventListener('mousedown', () => {
		ctrlNodes.colorDial.focus();
		ctrlNodes.colorDial.value = getCurrentColor();
		ctrlNodes.colorDial.click();
	});

	ctrlNodes.colorDial.addEventListener('change', () => {
		if (currMenuItem.type === 'expression') {
			Calc.setExpression({
				id: currMenuItem.id,
				color: ctrlNodes.colorDial.value
			});
		} else if (currMenuItem.type === 'table') {
			let expr = Calc.getExpressions();
			
			expr[getCurrentIndex()].columns[currMenuItem.colIndex].color = ctrlNodes.colorDial.value;
			
			Calc.setExpression({
				type:'table',
				id: currMenuItem.id,
				columns: expr[getCurrentIndex()].columns
			});
		}
		
	});

	/***************************************************************************/
	//FUNCTIONS

	// shows or hides button to access custom properties
	function showButton(value) {
		if (value) {
			ctrlNodes.colorButton.style.visibility = 'visible';
			ctrlNodes.colorButton.style.opacity = '1';
		} else {
			ctrlNodes.colorButton.style.visibility = 'hidden';
			ctrlNodes.colorButton.style.opacity = '0';
		}
	}

	function setButtonLocation() {
		let mnu = currMenuElement.getBoundingClientRect();
		let btn = ctrlNodes.colorButton.getBoundingClientRect();
		
		let x = (mnu.right + GUI_GAP);
		let y = (mnu.bottom - (mnu.height + btn.height) / 2);
		
		ctrlNodes.colorButton.style.left = `${x}px`;
		ctrlNodes.colorButton.style.top = `${y}px`;
	}

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
	}

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

		}
	}

	/***************************************************************************/
	// ELEMENT SEEKING FUNCTIONS

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
							
						}
					});
					
				}
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
						expCell = seekAttribute(expElem[0], '.dcg-cell.dcg-hovered', 'index')[0];
						
						expItem = {
							type: expType,
							id: expId.toString(),
							colIndex: expCell
						}
						break;
					case ITEM_EXPRESSION:
						expType = 'expression';
						expId = expElem[0].getAttribute('expr-id');
						
						expItem = {
							type: expType,
							id: expId.toString()
						}
						break;
					default:
						
				}
				
			}
			
			callback(menuElem, expItem, isFound);
			//console.table(watchList);
		});
		
		let menuContainer = findOptionsMenu();
		
		if (menuContainer !== null) {	
			menuObserver.observe(menuContainer, {
				childList: true
			});
			
		} else {
			console.log('couldn\'t find menu container');
			
		}
		
	}

	function getCurrentIndex () {
		let calcExpressions = Calc.getExpressions();
		return calcExpressions.findIndex(elem => elem.id === currMenuItem.id);
	}

	function getCurrentColor() {
		let calcExpressions = Calc.getExpressions();
		let index = calcExpressions.findIndex(elem => elem.id === currMenuItem.id);
		
		return calcExpressions[index].color;
	}

	// finds element that contains the color menu in Desmos
	function findOptionsMenu() {
		
		let targetChild = document.getElementsByClassName('dcg-exppanel-outer');
		
		if (targetChild.length == 1) {
			return targetChild[0].parentNode;
			
		} else {
			return null;
			
		}
	}

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
	}
})()
