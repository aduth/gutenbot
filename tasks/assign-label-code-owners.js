/*
 * External dependencies
 */
const { isEmpty, difference } = require( 'lodash' );
const { posix } = require( 'path' );
const minimatch = require( 'minimatch' );

/**
 * Repository paths at which to try to find CODEOWNERS file.
 *
 * @link https://help.github.com/articles/about-code-owners/
 *
 * @type {Array}
 */
const CODEOWNERS_PATHS = [
	'CODEOWNERS',
	posix.join( '.github', 'CODEOWNERS' ),
];

/**
 * Returns a Promise which resolves to an object where key is a CODEOWNERS path
 * pattern, the value an array of code owner usernames and teams, for all code
 * owner entries found in a codeowner path. Returns an empty object if there is
 * no CODEOWNERS file, or there was an error in attempting to read the file.
 *
 * @param {probot.context} context Probot event context.
 *
 * @return {Promise} Promise resolving to code owners.
 */
async function getCodeOwners( context ) {
	for ( let i = 0; i < CODEOWNERS_PATHS.length; i++ ) {
		const path = CODEOWNERS_PATHS[ i ];
		const params = context.repo( { path } );

		let content;
		try {
			const { data } = await context.github.repos.getContents( params );
			content = Buffer.from( data.content, 'base64' ).toString();
		} catch ( error ) {}

		if ( ! content ) {
			continue;
		}

		return content.split( '\n' ).reduce( ( result, line ) => {
			line = line
				// Remove suffixing inline comment.
				.replace( /#.*/, '' )
				.trim()
				// Collapse multiple spaces.
				.replace( / {2,}/, ' ' );

			if ( line && line.includes( ' ' ) ) {
				const [ pattern, ...owners ] = line.split( ' ' );
				result[ pattern ] = owners.map( ( owner ) => {
					// REST API accepts only owners without leading `@`.
					return owner.replace( /^@/, '' );
				} );
			}

			return result;
		}, {} );
	}

	return {};
}

/**
 * Returns a Promise which, given the path, resolves to an array of owner users
 * matching the path. Returns an empty array if code owners cannot be resolved
 * or there is no match.
 *
 * @param {probot.context} context Probot event context.
 * @param {string}         path    Path to test.
 *
 * @return {Promise} Promise resolving to code owner users matching path.
 */
async function getOwnersByPath( context, path ) {
	const allOwners = await getCodeOwners( context );

	for ( const [ pattern, owners ] of Object.entries( allOwners ) ) {
		const isMatch = minimatch( path, pattern );
		if ( isMatch ) {
			return owners;
		}
	}

	return [];
}

/**
 * Given a IssuesEvent.Labeled event context, adds assignees to the given issue
 * as determined by code owners associated with the label.
 *
 * @param {probot.context} context Probot event context.
 */
async function assignCodeOwners( context ) {
	const labelPaths = await context.config( 'label-paths.yml', {} );
	if ( isEmpty( labelPaths ) ) {
		return;
	}

	const { name } = context.payload.label;
	if ( ! labelPaths.hasOwnProperty( name ) ) {
		return;
	}

	const path = labelPaths[ name ];

	const owners = await getOwnersByPath( context, path );

	if ( ! owners.length ) {
		return;
	}

	const { assignees } = context.payload.issue;

	const toAdd = difference( owners, assignees );
	if ( ! toAdd.length ) {
		return;
	}

	await context.github.issues.addAssignees( context.issue( {
		assignees: toAdd,
	} ) );
}

module.exports = {
	'issues.labeled': assignCodeOwners,
};
