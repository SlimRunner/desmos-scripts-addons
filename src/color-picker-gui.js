/*
 * Author: SlimRunner
 *
 * Console script to help change colors of individual graphs easily
 *
*/

//detect changes in class
//https://stackoverflow.com/questions/42121565/detecting-class-change-without-setinterval

//JSON tree of GUI elements
const guiElements = {
	controls : [{
		name : 'div',
		id : 'miscButton',
		styles : {
			display : 'block',
			position : 'fixed',
			bottom : '4px',
			right : '4px',
			zIndex : '99',
			width : '38px',
			height : '38px',
			background : '#ededed'
		},
		classes : [
			'dcg-btn-flat-gray',
			'dcg-settings-pillbox',
			'dcg-action-settings'
		],
		controls : [
			{
				name : 'i',
				id : 'btnIcon',
				styles : {

				},
				classes : [
					'dcg-icon-magic'
				]
			}
		]
	},
	{
		name : 'div',
		id : 'pickerFrame',
		styles : {
			display : 'none',
			flexDirection: 'column',
			position : 'fixed',
			bottom : '4px',
			right : '4px',
			zIndex : '98',
			width : '256px',
			height : '324px',
			background : '#ededed',
			padding : '8px'
		},
		classes : [

		],
		controls : [
			{
				name : 'label',
				id : 'expIndexLabel',
				textContent: 'Select element',
				attributes: [
					{name: 'for', value : 'expIndex'}
				],
				styles : {
					color : 'black',
					fontSize : '14pt',
				},
				classes : [

				]
			},
			{
				name : 'input',
				id : 'expIndex',
				attributes: [
					{name: 'type', value : 'number'},
					{name: 'min', value : '1'},
					{name: 'step', value : '1'}
				],
				styles : {
					background : 'white',
					fontSize : '14pt',
					border : '1px solid #CCC',
					borderRadius: '4px',
					margin: '4px'
				},
				classes : [

				]
			},
			{
				name : 'label',
				id : 'colorInputLabel',
				textContent: 'pick color',
				attributes: [
					{name: 'for', value : 'colorInput'}
				],
				styles : {
					color : 'black',
					fontSize : '14pt',
				},
				classes : [

				]
			},
			{
				name : 'input',
				id : 'colorInput',
				attributes: [
					{name: 'type', value : 'color'}
				],
				styles : {
					background : 'white',
					fontSize : '14pt',
					border : '1px solid #CCC',
					borderRadius: '4px',
					margin: '4px'
				},
				classes : [

				]
			}
		]
	}]
}

/***************************************************************************/
//MAIN CODE

// initializes an array to hold the DOM objects (controls)
let ctrlList = [];
// furnishes the control list and also adds the elements to the DOM
insertNodes(guiElements, document.body, ctrlList);
//links the miscButton click-event to a fucntion
ctrlList.miscButton.addEventListener('click', miscButton_click);

/***************************************************************************/
//FUNCTIONS

// click event of the button
function miscButton_click() {
	if (ctrlList.pickerFrame.style.display == 'none') {
		ctrlList.pickerFrame.style.display = 'flex';
		ctrlList.expIndex.focus();
	}
	else if (ctrlList.expIndex.value != '') {
		let idx = parseInt(ctrlList.expIndex.value) - 1;
		let color = ctrlList.colorInput.value.trim();

		if (validateData(idx, color)) {
			let tempState = Calc.getState();

			tempState.expressions.list[idx].color = color;
			Calc.setState(tempState);

			ctrlList.expIndex.value = '';
			ctrlList.colorInput.value = '';
			ctrlList.pickerFrame.style.display = 'none';

			console.log('color changed successfully');
		}
	}
	else {
		ctrlList.colorInput.value = '';
		ctrlList.pickerFrame.style.display = 'none';
		console.log('no color was changed');
	}
}

//returns true if the index references a valid expression type item and the color is a valid HTML hex color
function validateData(index, color) {
	let tempState = Calc.getState();

	if (isNaN(index)) return false;
	if (index < 0 ||
		 index >= tempState.expressions.list.length)
		return false;

	let item = tempState.expressions.list[index];

	if (item.hasOwnProperty('type')) {
		if (item.type === 'expression') {
			let hexColRegex = /^#[A-Fa-f0-9]{6}$|^#[A-Fa-f0-9]{3}$/m;
			if (hexColRegex.test(color)) {
				return true;
			}
		}
		else {
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
		item.classes.forEach(elem => outControls[item.id].classList.add(elem));
		Object.assign(outControls[item.id].style, item.styles);

		if (item.hasOwnProperty('attributes')) {
			item.attributes.forEach(elem => outControls[item.id].setAttribute(elem.name, elem.value));
		}

		if (item.hasOwnProperty('textContent')) {
			outControls[item.id].innerText = item.textContent;
		}

		if (item.hasOwnProperty('controls'))
			insertNodes(item, outControls[item.id], outControls);
	}
}
