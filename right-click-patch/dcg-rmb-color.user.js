// ==UserScript==
// @name     	DesmosColorRightClick
// @namespace	slidav.Desmos
// @version  	1.1.2
// @author		SlimRunner (David Flores)
// @description	Overrides context menu for color bubble
// @grant    	none
// @match			https://*.desmos.com/calculator*
// @downloadURL	https://github.com/SlimRunner/desmos-scripts-addons/raw/master/right-click-patch/dcg-rmb-color.user.js
// @updateURL	https://github.com/SlimRunner/desmos-scripts-addons/raw/master/right-click-patch/dcg-rmb-color.user.js
// ==/UserScript==

/*jshint esversion: 6 */

(function() {
	'use strict';
	
	var Desmos;
	var tm_win;
	var tm_doc;
	
	// initializes the event listeners
	function initListeners () {
		let showContextMenu = true;
		
		// cancels standard context menu
		tm_doc.addEventListener("contextmenu", (e) => {
			if (!showContextMenu) {
				showContextMenu = true;
				e.preventDefault();
			}
		});
		
		// triggers the color menu and sets flag to cancel standard context menu
		tm_win.addEventListener('mousedown', (e) => {
			if (e.button === 2) {
				let tag = e.target.tagName.toLowerCase();
				
				// determines if clicked target is an icon container
				let isIconContainer = (tagName, lvl, type) => {
					let container = seekParent(e.target, lvl);
					if (container === null) return false;
					return (
						tag === tagName &&
						'classList' in container &&
						container.classList.contains(`dcg-${type}-icon-container`)
					);
				};
				
				// determines if container is part of an expression or image
				let hasLongHoldButton = (lvl) => {
					let wrapper = seekParent(e.target, lvl + 1);
					if (wrapper === null) return false;
					if (typeof wrapper.classList === 'undefined') return false;
					return (
						wrapper.classList.contains('dcg-expression-icon-container') !== -1
					);
				};
				
				if ( // hidden color bubble of expressions or images
					isIconContainer('span', 2, 'expression') &&
					hasLongHoldButton(1)
				) {
					showContextMenu = false;
					Desmos.$(seekParent(e.target, 1)).trigger('dcg-longhold');
					
				} else if ( // shown color bubble of expressions
					isIconContainer('i', 3, 'expression') &&
					hasLongHoldButton(2)
				) {
					showContextMenu = false;
					Desmos.$(seekParent(e.target, 2)).trigger('dcg-longhold');
					
				} else if ( // hidden color bubble of table columns
					isIconContainer('span', 2, 'table')
				) {
					showContextMenu = false;
					Desmos.$(seekParent(e.target, 1)).trigger('dcg-longhold');
					
					
				} else if ( // shown color bubble of table columns
					isIconContainer('i', 3, 'table')
				) {
					showContextMenu = false;
					Desmos.$(seekParent(e.target, 2)).trigger('dcg-longhold');
					
				}
			}
		});
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
	
	// initializes the script
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
			Desmos = window.wrappedJSObject.Desmos;
			tm_win = window.wrappedJSObject;
			tm_doc = window.wrappedJSObject.document;
			initListeners();
			console.log('Right click override for color loaded properly');
		}
	}());
	
}());
