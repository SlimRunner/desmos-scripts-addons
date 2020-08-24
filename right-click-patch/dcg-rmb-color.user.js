// ==UserScript==
// @name     	DesmosColorRightClick
// @namespace	slidav.Desmos
// @version  	1.1.0
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
				let container = null;
				let ariaLabel = '';
				
				if ( // hidden color bubble of expressions or images
					tag === 'span' &&
					(container = seekParent(e.target, 2)) !== null &&
					'classList' in container &&
					container.classList.contains('dcg-expression-icon-container') &&
					(ariaLabel = seekParent(e.target, 1).getAttribute("aria-label")) &&
					(
						ariaLabel.search('Expression') !== -1 ||
						ariaLabel.search('Image') !== -1
					)
				) {
					showContextMenu = false;
					Desmos.$(seekParent(e.target, 1)).trigger('dcg-longhold');
					
				} else if ( // shown color bubble of expressions
					tag === 'i' &&
					(container = seekParent(e.target, 3)) !== null &&
					'classList' in container &&
					container.classList.contains('dcg-expression-icon-container') &&
					(ariaLabel = seekParent(e.target, 2).getAttribute("aria-label")) &&
					(
						ariaLabel.search('Expression') !== -1 ||
						ariaLabel.search('Image') !== -1
					)
				) {
					showContextMenu = false;
					Desmos.$(seekParent(e.target, 2)).trigger('dcg-longhold');
					
				} else if ( // hidden color bubble of table columns
					tag === 'span' &&
					(container = seekParent(e.target, 2)) !== null &&
					'classList' in container &&
					container.classList.contains('dcg-table-icon-container')
				) {
					showContextMenu = false;
					Desmos.$(seekParent(e.target, 1)).trigger('dcg-longhold');
					
					
				} else if ( // shown color bubble of table columns
					tag === 'i' &&
					(container = seekParent(e.target, 3)) !== null &&
					'classList' in container &&
					container.classList.contains('dcg-table-icon-container')
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
