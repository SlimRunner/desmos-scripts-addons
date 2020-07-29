// ==UserScript==
// @name     	DesmosColorRightClick
// @namespace	slidav.Desmos
// @version  	0.0.1
// @author		SlimRunner (David Flores)
// @description	Overrides context menu for color bubble
// @grant    	none
// @match			https://*.desmos.com/calculator*
// ==/UserScript==

// @downloadURL	https://gist.github.com/SlimRunner/GISTID/raw/dgc-rmb-color.user.js
// @updateURL	https://gist.github.com/SlimRunner/GISTID/raw/dgc-rmb-color.user.js
/*jshint esversion: 6 */

var Desmos;
var tm_win;
var tm_doc;

function initListeners () {
	'use strict';
	
	let showContextMenu = true;
	
	tm_doc.addEventListener("contextmenu", (e) => {
		if (!showContextMenu) {
			showContextMenu = true;
			e.preventDefault();
		}
	});
	
	tm_win.addEventListener('mousedown', (e) => {
		if (
			e.button === 2 &&
			typeof e.target.classList === 'object' &&
			typeof e.target.className === 'string' &&
			e.target.classList.contains('dcg-hovered') &&
			(e.target.classList.contains('dcg-layered-icon') ||
			e.target.classList.contains('dcg-circular-icon'))
		) {
			const ICON_DICTIONARY = `boxplot cross distribution dotplot-cross dotplot-default dotplot-open histogram move move-horizontal move-vertical open parametric-dashed parametric-dotted parametric-solid point points polygon-filled polygon-solid`;
			
			// isolate icon name using regex
			let targetName = e.target.className.match(/(?<=dcg-icon-)[a-z\-]+/im);
			
			if (
				ICON_DICTIONARY.search(targetName) !== -1
			) {
				showContextMenu = false;
				Desmos.$(e.target.parentElement.parentElement).trigger('dcg-longhold');
			} else if (
				e.target.className.search('dcg-do-not-blur') !== -1
			) {
				showContextMenu = false;
				Desmos.$(e.target.parentElement).trigger('dcg-longhold');
			}
			
		}
	});
}

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
		Desmos = window.wrappedJSObject.Desmos;
		tm_win = window.wrappedJSObject;
		tm_doc = window.wrappedJSObject.document;
		initListeners();
		console.log('Right click override for color loaded properly');
	}
})();
