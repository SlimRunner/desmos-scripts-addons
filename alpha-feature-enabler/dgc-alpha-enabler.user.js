// ==UserScript==
// @name     	DesmosAlphaEnabler
// @namespace	slidav.Desmos
// @version  	1.0.2
// @author		SlimRunner (David Flores)
// @description	Enables simulation and advanced styling automatically
// @grant    	none
// @match			https://*.desmos.com/calculator*
// @downloadURL	https://github.com/SlimRunner/desmos-scripts-addons/raw/master/alpha-feature-enabler/dgc-alpha-enabler.user.js
// @updateURL	https://github.com/SlimRunner/desmos-scripts-addons/raw/master/alpha-feature-enabler/dgc-alpha-enabler.user.js
// ==/UserScript==

/*jshint esversion: 6 */

(function() {
	'use strict';
	var Desmos;
	var Calc;
	
	defineScript();
	
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
			Desmos = window.Desmos;
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
				
				Calc.updateSettings({
					clickableObjects: true,
					advancedStyling: true
				});
				
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
	
} ());
