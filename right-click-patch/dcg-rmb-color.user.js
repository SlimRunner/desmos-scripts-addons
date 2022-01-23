// ==UserScript==
// @name        DesmosColorRightClick
// @namespace   slidav.Desmos
// @version     1.1.6
// @author      SlimRunner (David Flores)
// @description Overrides context menu for color bubble
// @grant       none
// @match       https://*.desmos.com/calculator*
// @match       https://*.desmos.com/activitybuilder/custom/*/edit*
// @downloadURL https://github.com/SlimRunner/desmos-scripts-addons/raw/master/right-click-patch/dcg-rmb-color.user.js
// @updateURL   https://github.com/SlimRunner/desmos-scripts-addons/raw/master/right-click-patch/dcg-rmb-color.user.js
// ==/UserScript==

/*jshint esversion: 6 */

(function() {
	'use strict';
	const QRY_EDITOR_MAIN = '.editor-main .editor-main-container';
	const IS_BUILDER = isActivityBuilder();
	
	var Desmos;
	
	defineScript();
	
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	// Main Script
	
	// initializes the event listeners
	function initListeners () {
		const isInDesmodder = (
			window.DesModder == undefined?
			() => false:
			() => window.DesModder.controller.isPluginEnabled('right-click-tray')
		);
		let showContextMenu = true;
		
		// cancels standard context menu
		document.addEventListener("contextmenu", (e) => {
			if (!showContextMenu) {
				showContextMenu = true;
				e.preventDefault();
			}
		});
		
		// triggers the color menu and sets flag to cancel standard context menu
		window.addEventListener('mousedown', (e) => {
			if (e.button === 2 && !isInDesmodder()) {
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
	
	// determines if the context is that of an activitybuilder app
	function isActivityBuilder() {
		return /https:\/\/.*\.desmos\.com\/activitybuilder\/custom\/\w*\/edit.*/.test(document.URL);
	}
	
	// checks if calc and desmos are defined
	function isCalcReady() {
		if (
			IS_BUILDER &&
			window.Desmos !== undefined &&
			document.querySelector(QRY_EDITOR_MAIN) !== null
		) {
			Desmos = window.Desmos;
			return true;
		} else if (
			window.Desmos !== undefined &&
			window.Calc !== undefined
		) {
			Desmos = window.Desmos;
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
				
				initListeners();
				
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
