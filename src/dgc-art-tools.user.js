// ==UserScript==
// @name     	DesmosArtTools
// @namespace	slidav.Desmos
// @version  	1.0.2
// @author		SlimRunner (David Flores)
// @description	Adds a color picker to Desmos
// @grant    	none
// @match			https://*.desmos.com/calculator*
// @downloadURL	https://gist.github.com/SlimRunner/aacc9cea998a3a8da31eae9d487412d7/raw/dgc-art-tools.user.js
// @updateURL	https://gist.github.com/SlimRunner/aacc9cea998a3a8da31eae9d487412d7/raw/dgc-art-tools.user.js
// ==/UserScript==

/*jshint esversion: 6 */

var Calc;
var Desmos;

(function loadCheck () {
	
	if (typeof attempts === 'undefined') {
		this.attempts = 0;
	} else {
		this.attempts++;
	}
	
	if (
		typeof window.wrappedJSObject.Calc === 'undefined' ||
		typeof window.wrappedJSObject.Desmos === 'undefined'
	) {
		
		if (this.attempts < 10) {
			console.log('Loading Desmos objects...');
			window.setTimeout(loadCheck, 1000);
		} else {
			console.log("Abort: The script couldn't load properly :/");
		}
		
	} else {
		Calc = window.wrappedJSObject.Calc;
		Desmos = window.wrappedJSObject.Desmos;
		console.log('Desmos is ready ✔️');
		customPropMenu();
		console.log('Custom art tools were loaded properly');
		console.log('written by\n _____ _ _          ______                            \n/  ___| (_)         | ___ \\                           \n\\ `--.| |_ _ __ ___ | |_/ /   _ _ __  _ __   ___ _ __ \n `--. \\ | | \'_ ` _ \\|    / | | | \'_ \\| \'_ \\ / _ \\ \'__|\n/\\__/ / | | | | | | | |\\ \\ |_| | | | | | | |  __/ |   \n\\____/|_|_|_| |_| |_\\_| \\_\\__,_|_| |_|_| |_|\\___|_|   \n                                                      \n                                                      ');
	}
})();

function customPropMenu () {
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
			textContent : `
			.sli-prop-menu {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
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
			`
		}]
	};

	// Object tree of GUI elements
	const guiElements = {
		controls : [{
			name : 'div',
			id : 'propMenu',
			classes : [
				'sli-prop-menu',
				'dcg-options-menu'
			],
			controls : [{
				name : 'input',
				id : 'colorButton',
				attributes: [
					{name: 'type', value: 'color'}
				],
				classes : [
					'sli-menu-button',
					'dcg-btn-flat-gray'
				]
			}, {
				name : 'button',
				id : 'opacityButton',
				textContent: ':)',
				classes : [
					'sli-menu-button',
					'dcg-btn-flat-gray'
				]
			}]
		}]
	};

	/***************************************************************************/
	// INITIALIZATION

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
	let propMenuActive = false;
	let desmosMenuActive = false;
	
	// callback that executes when the color menu shows up
	hookMenu( (itemElem, expItem, isFound) => {
		
		desmosMenuActive = isFound;
		
		if (isFound) {
			currMenuItem = expItem;
			currMenuElement = itemElem;
			setMenuLocation();
		}
		
		if (!propMenuActive) {
			showPropMenu(isFound);
		}
		
	});
	
	/***************************************************************************/
	// EVENTS
	
	let buttonList = [ctrlNodes.colorButton, ctrlNodes.opacityButton];
	
	// hides button when menu is gone and the mouse left the button client area
	bindListeners(buttonList, 'mouseleave', () => {
		if (!desmosMenuActive) {
			propMenuActive = false;
			showPropMenu(false);
		}
		
	});
	
	// changes button state to active so that button doesn't go away with menu
	bindListeners(buttonList, 'mousedown', () => {
		propMenuActive = true;
	});
	
	// performs click changes button state to false and hides button
	bindListeners(buttonList, 'click', () => {
		propMenuActive = false;
		showPropMenu(false);
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
	function showPropMenu(value) {
		if (value) {
			ctrlNodes.propMenu.style.visibility = 'visible';
			ctrlNodes.propMenu.style.opacity = '1';
			
			try {
				ctrlNodes.colorButton.value = getHexColor(getCurrentColor());
			} catch (e) {
				console.log(e.message);
			} finally {
				// nothing to do
			}
			
			Calc.observeEvent('change', () => {
				ctrlNodes.colorButton.value = getHexColor(getCurrentColor());
			});
			
		} else {
			ctrlNodes.propMenu.style.visibility = 'hidden';
			ctrlNodes.propMenu.style.opacity = '0';
			
			Calc.unobserveEvent('change');
		}
	} // !showPropMenu ()

	function setMenuLocation() {
		const BORDER_SIZE = 2;
		
		let mnu = currMenuElement.getBoundingClientRect();
		let btn = ctrlNodes.colorButton.getBoundingClientRect();
		
		let x = mnu.left + mnu.width + GUI_GAP;
		let y = mnu.top;
		
		ctrlNodes.propMenu.style.left = `${x}px`;
		ctrlNodes.propMenu.style.top = `${y}px`;
	} // !setMenuLocation ()
	
	/***************************************************************************/
	// DOM MANAGEMENT
	
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
	
} // !colorPicker ()

/***************************************************************************/
// HELPER FUNCTIONS

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



// binds the events of provided list of elements to a single callback
function bindListeners(elemList, eventName, callback) {
	for (var elem of elemList) {
		elem.addEventListener(eventName, callback);
	}
} // !bindListeners ()



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



// returns a valid 6-digit hex from the input
function getHexColor (input) {
	if (typeof input !== 'string') {
		throw	Error('input must be a string');
	}
	
	input = input.trim();
	
	const fullHex = /^#([0-9a-z]{2})([0-9a-z]{2})([0-9a-z]{2})$/i;
	const halfHex = /^#([0-9a-z])([0-9a-z])([0-9a-z])$/i;
	const cssRGB = /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i;
	const cssRGBA = /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+.?\d*|\d*.?\d+)\s*\)$/i;
	
	if (fullHex.test(input)) {
		return input;
	}
	
	// check if input is 3-digit hex
	let rgxm = input.match(halfHex);
	
	if (rgxm) {
		let r = rgxm[1] + rgxm[1];
		let g = rgxm[2] + rgxm[2];
		let b = rgxm[3] + rgxm[3];
		
		return `#${r}${g}${b}`;
	}
	
	// check if input is RGB or RGBA css function
 	rgxm = input.match(cssRGB);
	if (!rgxm) rgxm = input.match(cssRGBA);
	
	if (rgxm) {
		let r = parseInt(rgxm[1]).toString(16);
		let g = parseInt(rgxm[2]).toString(16);
		let b = parseInt(rgxm[3]).toString(16);
		
		return `#${hex6Pad(r)}${hex6Pad(g)}${hex6Pad(b)}`;
	}
	
	// return value for named color or throw error
	return parseNamedColor(input);
} // !getHexColor ()



// returns a padded couplet from a 6-digit hex
function hex6Pad(value) {
	if (typeof value !== 'string') {
		throw	Error('value must be a string');
	}
	
	if (value.length === 1) {
		return '0' + value;
	} else {
		return value;
	}
} // !hex6Pad ()



// returns hex value from given named color
function parseNamedColor(input) {
	const NAME_TABLE = {
		'black' : '#000000',
		'navy' : '#000080',
		'darkblue' : '#00008b',
		'mediumblue' : '#0000cd',
		'blue' : '#0000ff',
		'darkgreen' : '#006400',
		'green' : '#008000',
		'teal' : '#008080',
		'darkcyan' : '#008b8b',
		'deepskyblue' : '#00bfff',
		'darkturquoise' : '#00ced1',
		'mediumspringgreen' : '#00fa9a',
		'lime' : '#00ff00',
		'springgreen' : '#00ff7f',
		'aqua' : '#00ffff',
		'cyan' : '#00ffff',
		'midnightblue' : '#191970',
		'dodgerblue' : '#1e90ff',
		'lightseagreen' : '#20b2aa',
		'forestgreen' : '#228b22',
		'seagreen' : '#2e8b57',
		'darkslategray' : '#2f4f4f',
		'darkslategrey' : '#2f4f4f',
		'limegreen' : '#32cd32',
		'mediumseagreen' : '#3cb371',
		'turquoise' : '#40e0d0',
		'royalblue' : '#4169e1',
		'steelblue' : '#4682b4',
		'darkslateblue' : '#483d8b',
		'mediumturquoise' : '#48d1cc',
		'indigo' : '#4b0082',
		'darkolivegreen' : '#556b2f',
		'cadetblue' : '#5f9ea0',
		'cornflowerblue' : '#6495ed',
		'rebeccapurple' : '#663399',
		'mediumaquamarine' : '#66cdaa',
		'dimgray' : '#696969',
		'dimgrey' : '#696969',
		'slateblue' : '#6a5acd',
		'olivedrab' : '#6b8e23',
		'slategray' : '#708090',
		'slategrey' : '#708090',
		'lightslategray' : '#778899',
		'lightslategrey' : '#778899',
		'mediumslateblue' : '#7b68ee',
		'lawngreen' : '#7cfc00',
		'chartreuse' : '#7fff00',
		'aquamarine' : '#7fffd4',
		'maroon' : '#800000',
		'purple' : '#800080',
		'olive' : '#808000',
		'gray' : '#808080',
		'grey' : '#808080',
		'skyblue' : '#87ceeb',
		'lightskyblue' : '#87cefa',
		'blueviolet' : '#8a2be2',
		'darkred' : '#8b0000',
		'darkmagenta' : '#8b008b',
		'saddlebrown' : '#8b4513',
		'darkseagreen' : '#8fbc8f',
		'lightgreen' : '#90ee90',
		'mediumpurple' : '#9370db',
		'darkviolet' : '#9400d3',
		'palegreen' : '#98fb98',
		'darkorchid' : '#9932cc',
		'yellowgreen' : '#9acd32',
		'sienna' : '#a0522d',
		'brown' : '#a52a2a',
		'darkgray' : '#a9a9a9',
		'darkgrey' : '#a9a9a9',
		'lightblue' : '#add8e6',
		'greenyellow' : '#adff2f',
		'paleturquoise' : '#afeeee',
		'lightsteelblue' : '#b0c4de',
		'powderblue' : '#b0e0e6',
		'firebrick' : '#b22222',
		'darkgoldenrod' : '#b8860b',
		'mediumorchid' : '#ba55d3',
		'rosybrown' : '#bc8f8f',
		'darkkhaki' : '#bdb76b',
		'silver' : '#c0c0c0',
		'mediumvioletred' : '#c71585',
		'indianred' : '#cd5c5c',
		'peru' : '#cd853f',
		'chocolate' : '#d2691e',
		'tan' : '#d2b48c',
		'lightgray' : '#d3d3d3',
		'lightgrey' : '#d3d3d3',
		'thistle' : '#d8bfd8',
		'orchid' : '#da70d6',
		'goldenrod' : '#daa520',
		'palevioletred' : '#db7093',
		'crimson' : '#dc143c',
		'gainsboro' : '#dcdcdc',
		'plum' : '#dda0dd',
		'burlywood' : '#deb887',
		'lightcyan' : '#e0ffff',
		'lavender' : '#e6e6fa',
		'darksalmon' : '#e9967a',
		'violet' : '#ee82ee',
		'palegoldenrod' : '#eee8aa',
		'lightcoral' : '#f08080',
		'khaki' : '#f0e68c',
		'aliceblue' : '#f0f8ff',
		'honeydew' : '#f0fff0',
		'azure' : '#f0ffff',
		'sandybrown' : '#f4a460',
		'wheat' : '#f5deb3',
		'beige' : '#f5f5dc',
		'whitesmoke' : '#f5f5f5',
		'mintcream' : '#f5fffa',
		'ghostwhite' : '#f8f8ff',
		'salmon' : '#fa8072',
		'antiquewhite' : '#faebd7',
		'linen' : '#faf0e6',
		'lightgoldenrodyellow' : '#fafad2',
		'oldlace' : '#fdf5e6',
		'red' : '#ff0000',
		'fuchsia' : '#ff00ff',
		'magenta' : '#ff00ff',
		'deeppink' : '#ff1493',
		'orangered' : '#ff4500',
		'tomato' : '#ff6347',
		'hotpink' : '#ff69b4',
		'coral' : '#ff7f50',
		'darkorange' : '#ff8c00',
		'lightsalmon' : '#ffa07a',
		'orange' : '#ffa500',
		'lightpink' : '#ffb6c1',
		'pink' : '#ffc0cb',
		'gold' : '#ffd700',
		'peachpuff' : '#ffdab9',
		'navajowhite' : '#ffdead',
		'moccasin' : '#ffe4b5',
		'bisque' : '#ffe4c4',
		'mistyrose' : '#ffe4e1',
		'blanchedalmond' : '#ffebcd',
		'papayawhip' : '#ffefd5',
		'lavenderblush' : '#fff0f5',
		'seashell' : '#fff5ee',
		'cornsilk' : '#fff8dc',
		'lemonchiffon' : '#fffacd',
		'floralwhite' : '#fffaf0',
		'snow' : '#fffafa',
		'yellow' : '#ffff00',
		'lightyellow' : '#ffffe0',
		'ivory' : '#fffff0',
		'white' : '#ffffff'
	}; // !NAME_TABLE
	
	if (NAME_TABLE.hasOwnProperty(input.toLowerCase())) {
		return NAME_TABLE[input.toLowerCase()];
	} else {
		throw Error(input + ' is not a supported named color');
	}
} // !parseNamedColor ()
