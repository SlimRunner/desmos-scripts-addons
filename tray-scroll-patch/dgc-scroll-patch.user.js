// ==UserScript==
// @name     	ColorTrayPatch
// @namespace	slidav.Desmos
// @version  	1.0.0
// @author		SlimRunner (David Flores)
// @description	Adds a color picker to Desmos
// @grant    	none
// @match			https://*.desmos.com/calculator*
// ==/UserScript==

// @downloadURL	
// @updateURL	

/*jshint esversion: 6 */

(function() {
	'use strict';
	var Calc;
	var Desmos;
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
			'.dcg-options-menu-section .dcg-options-menu-content .dcg-color-picker-container',
			
			(elem, found) => {
				if (found) {
					if (elem.offsetHeight > 169) {
						elem.classList.add('sli-cts-scroll-flex');
						seekParent(elem, 4).classList.add('sli-cts-size-adjustment');
					} else {
						elem.classList.remove('sli-cts-scroll-flex');
						seekParent(elem, 4).classList.remove('sli-cts-size-adjustment');
					}
					
				}
			}
			
		);
		
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
			
			// calls predicate to process the output
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
	
	// returns attribute of first instance of query
	function seekAttribute(parent, selectors, attName) {
		let node = parent.querySelector(selectors);
		
		if (!(node === null && typeof node.getAttributeNames !== 'function')) {
			return node.getAttribute(attName);
		}
		
		return null;
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
				console.warn("Abort: tray scroll patch could not load :(");
			}
			
		} else {
			Calc = window.wrappedJSObject.Calc;
			Desmos = window.wrappedJSObject.Desmos;
			
			try {
				initMain();
			} catch (ex) {
				console.error(`${ex.name}: ${ex.message}`);
				console.log('An error was encountered while loading');
			} finally {
				// Nothing to do here yet...
			}
			
		}
	} ());
	
}());
