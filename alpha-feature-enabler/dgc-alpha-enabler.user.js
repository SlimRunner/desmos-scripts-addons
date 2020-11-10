// ==UserScript==
// @name     	DesmosAlphaEnabler
// @namespace	slidav.Desmos
// @version  	1.0.0
// @author		SlimRunner (David Flores)
// @description	Enables simulation and advanced styling automatically
// @grant    	none
// @match			https://*.desmos.com/calculator*
// @downloadURL	
// @updateURL	
// ==/UserScript==

/*jshint esversion: 6 */

(function() {
	'use strict';
	var Calc;
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// User-Script Initialization
	
	// iife that checks if Desmos has finished loading (10 attempts)
	(function loadCheck () {
		if (typeof loadCheck.attempts === 'undefined') {
			loadCheck.attempts = 0;
		} else {
			loadCheck.attempts++;
		}
		
		if (
			typeof window.wrappedJSObject.Calc === 'undefined'
		) {
			
			if (loadCheck.attempts < 10) {
				window.setTimeout(loadCheck, 1000);
			} else {
				console.log("Abort: The script couldn't load properly :/");
			}
			
		} else {
			Calc = window.wrappedJSObject.Calc;
			
			try {
				// This methods were discovered by u/ElFisho
				Calc.updateSettings({
					clickableObjects: true,
					advancedStyling: true,
					administerSecretFolders: true
				});
				console.log('Alpha features were enabled');
			} catch (ex) {
				console.error(`${ex.name}: ${ex.message}`);
				console.log('An error was encountered while loading');
			} finally {
				// Nothing to do here yet...
			}
			
		}
	} ());
	
} ());
