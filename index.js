/*
 * External dependencies
 */
const { forEach } = require( 'lodash' );
const requireindex = require( 'requireindex' );

/**
 * Array of task objects, where each object key is a Probot-formatted event
 * name, the value a function handler for the event.
 *
 * @type {Object[]}
 */
const tasks = Object.values( requireindex( 'tasks' ) );

/**
 * Entry-point for the Probot application.
 *
 * @param {probot.Application} app Probot Application instance.
 */
function start( app ) {
	tasks.forEach( ( task ) => {
		forEach( task, ( handler, eventName ) => app.on( eventName, handler ) );
	} );
}

module.exports = start;
