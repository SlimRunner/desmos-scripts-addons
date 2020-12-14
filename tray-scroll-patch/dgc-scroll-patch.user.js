// ==UserScript==
// @name        ColorTrayPatch
// @namespace   slidav.Desmos
// @version     1.0.6
// @author      SlimRunner (David Flores)
// @description Adds a color picker to Desmos
// @grant       none
// @match       https://*.desmos.com/calculator*
// @downloadURL https://github.com/SlimRunner/desmos-scripts-addons/raw/master/tray-scroll-patch/dgc-scroll-patch.user.js
// @updateURL   https://github.com/SlimRunner/desmos-scripts-addons/raw/master/tray-scroll-patch/dgc-scroll-patch.user.js
// ==/UserScript==

/*jshint esversion: 6 */

(function() {
	'use strict';
	const TRAY_QUERY = '.dcg-options-menu-section .dcg-options-menu-content .dcg-color-picker-container';
	
	var Calc;
	
	defineScript();
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// Main Script
	
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
	
	// initializes the script
	function initMain() {
		let observingCalc = false;
		
		insertNodes(document.head, {
			group: [{
				tag : 'style',
				id : 'sli-tray-scroll',
				attributes : [
					{name: 'type', value: 'text/css'}
				],
				nodeContent : `
				.sli-cts-scroll-flex {
					display: flex;
					flex-direction: column;
					max-height: 170px;
					overflow-y: scroll;
				}
				.sli-cts-size-adjustment{
					width: 240px !important;
				}
				`
			}]
		});
		
		hookMenu(
			TRAY_QUERY,
			
			(elem, found) => {
				let parent = seekParent(elem, 4);
				if (found) {
					changeTraySize(elem);
					
					observingCalc = true;
					// update tray dynamically
					Calc.observeEvent('change.colortray', () => {
						let elem = parent.querySelector(TRAY_QUERY);
						if (elem !== null) {
							changeTraySize(elem);
						}
					});
					
				} else if (observingCalc) {
					observingCalc = false;
					// stop observing changes on desmos color menu (was closed)
					Calc.unobserveEvent('change.colortray');
				}
			}
			
		);
		
	}
	
	// adds css classes tray palette and its outermost parent
	function changeTraySize(elem) {
		if (elem.offsetHeight > 169) {
			let parent = seekParent(elem, 4);
			let sibling = parent.querySelector('.dcg-triangle');
			elem.classList.add('sli-cts-scroll-flex');
			parent.classList.add('sli-cts-size-adjustment');
			
			let bodyRect = document.body.getBoundingClientRect();
			let parRect = parent.getBoundingClientRect();
			let sibRect = sibling.getBoundingClientRect();
			
			//bd.h - (mid - 22 + panel.h + 7)
			let targetMid = bodyRect.height - parRect.height + 15 - ((sibRect.bottom + sibRect.top) / 2);
			
			if (targetMid < 0) {
				parent.style.marginTop = `${targetMid}px`;
				sibling.style.marginTop = `${-targetMid}px`;
			} else {
				parent.style.marginTop = `${0}px`;
				sibling.style.marginTop = `${0}px`;
			}
		} else {
			elem.classList.remove('sli-cts-scroll-flex');
			seekParent(elem, 4).classList.remove('sli-cts-size-adjustment');
		}
	}
	
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
	
	// triggers a callback whenever an expression menu in Desmos is deployed
	function hookMenu(mainQuery, callback) {
		// initializes observer
		let menuObserver = new MutationObserver( obsRec => {
			let menuElem;
			let isFound = false;
			
			// seek for color context menu, sets isFound to true when found
			obsRec.forEach((record) => {
				record.addedNodes.forEach((node) => {
					if ( typeof node.querySelector === 'function' && !isFound) {
						menuElem = node.querySelector(mainQuery);
						if (menuElem !== null) isFound = true;
					}
				});
			});
			
			// executes callback with data found
			callback(menuElem, isFound);
			
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
	
	// returns parent of first instance of query
	function getParentByQuery(node, selectors) {
		let targetChild = node.querySelector(selectors);
		if (targetChild === null) return null;
		return targetChild.parentNode;
	}
	
	// traverse the DOM tree to find parentElements iteratively
	function seekParent(src, level) {
		if (level <= 0) return src;
		
		for (var i = 0; i < level; ++i) {
			if (src != null) {
				src = src.parentElement;
			} else {
				return null;
			}
		}
		
		return src;
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
				
				initMain();
				
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
