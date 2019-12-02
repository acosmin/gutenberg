/**
 * External dependencies
 */
import { escape, reduce, map, filter, difference, concat, isEqual } from 'lodash';

/**
 * WordPress dependencies
 */
import {
	Fragment,
	useEffect,
	useState,
} from '@wordpress/element';
import {
	InnerBlocks,
	InspectorControls,
	BlockControls,
	__experimentalUseColors,
} from '@wordpress/block-editor';

import { createBlock } from '@wordpress/blocks';
import { withSelect, withDispatch } from '@wordpress/data';
import {
	CheckboxControl,
	PanelBody,
	Spinner,
	Toolbar,
	Placeholder,
	Button,
} from '@wordpress/components';
import { compose } from '@wordpress/compose';

import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import useBlockNavigator from './use-block-navigator';
import BlockNavigationList from './block-navigation-list';
import BlockColorsStyleSelector from './block-colors-selector';
import { useQueryPages } from './use-query';

/**
 * Map pages IDs to <NavigationLink /> blocks.
 *
 * @param {array} ids Pages id to map.
 * @param {array} pages Pages collection.
 * @return {array} <NavigationLink /> collection.
 */
const mapItemsFromPagesId = ( ids, pages ) => map( ids, ( id ) => {
	const { type, url, title } = filter( pages, ( { id: page_id } ) => page_id === id )[0];
	return createBlock(
		'core/navigation-link',
		{ type, id, url, label: escape(title), title: escape(title), opensInNewTab: false }
	)
} );

function Navigation( {
	attributes,
	clientId,
	setAttributes,
	hasExistingNavItems,
	updateNavItemBlocks,
	innerBlocks,
} ) {
	/* eslint-disable @wordpress/no-unused-vars-before-return */
	const { TextColor } = __experimentalUseColors(
		[ { name: 'textColor', property: 'color' } ],
	);
	/* eslint-enable @wordpress/no-unused-vars-before-return */
	const { navigatorToolbarButton, navigatorModal } = useBlockNavigator( clientId );

	const { items } = attributes;

	const [ pageNavigationItems, setPageNavigationItems ] = useState( [] );

	const [ populateFromExistingPages, setPopulateFromExistingPages ] = useState( false );

	/**
	 * Fetching data.
	 */
	const { data: pages, isValidating: isRequestingPages,  } = useQueryPages( {
		parent: 0,
		order: 'asc',
		orderby: 'id',
	} );

	/**
	 * Items checker.
	 * Checks if the current Navigation menu has duplicated and unadded items,
	 * building an object with the following shape:
	 *
	 *   {
	 *     items: {
	 *         <page-id>: <count>, -> Amount of items with this ID. Generally this value is `1`.
	 *         ...: n,
	 *     },
	 *     ids: [ <page-id>, ... ], -> Current items with the pages ids,
	 *     repeated: [ <page-id>, ... ], -> All of repeated items with the same page ID,
	 *     unadded: [ <page-id>, ... ], -> Page IDs which have not been added to the nav.
	 * }
	 */
	useEffect( () => {
		const itemsChecker = reduce(
			map(
				filter( innerBlocks, ( { attributes: attrs } ) => attrs.id && attrs.id >= 0 ),
				( { attributes } ) => ( {
					id: attributes.id,
				} )
			),
			( acc, item ) => ( {
				items: { ...acc.items, [ item.id ]: acc.items[ item.id ] ? acc.items[ item.id ] + 1 : 1 },
				ids: [ ...acc.ids, item.id ],
				repeated: acc.items[ item.id ] ? [ ...acc.repeated, item.id ] : acc.repeated,
			} ),
			{ items: {}, ids: [], repeated: [] }
		);

		itemsChecker.unadded = difference( map( pages, ( { id } ) => ( id ) ), itemsChecker.ids );

		if ( itemsChecker.unadded.length ) {
			setPageNavigationItems( concat( mapItemsFromPagesId( itemsChecker.unadded, pages ), innerBlocks ) );
		}

		if ( ! isEqual( itemsChecker.unadded.sort(), items.unadded.sort() ) ) {
			setAttributes( { items: itemsChecker } );
		}

	}, [ pages, innerBlocks ] );

	/*
	 * Update Navigation links.
	 */
	useEffect( () => {
		if ( populateFromExistingPages ) {
			updateNavItemBlocks( pageNavigationItems );
		}
	}, [ populateFromExistingPages, pageNavigationItems ] );

	const handleCreateEmpty = () => {
		const emptyNavLinkBlock = createBlock( 'core/navigation-link' );
		updateNavItemBlocks( [ emptyNavLinkBlock ] );
	};

	const hasPages = pages && pages.length;

	// If we don't have existing items or the User hasn't
	// indicated they want to automatically add top level Pages
	// then show the Placeholder
	if ( ! hasExistingNavItems ) {
		return (
			<Fragment>
				<InspectorControls>
					{ ! isRequestingPages && (
						<PanelBody
							title={ __( 'Navigation Settings' ) }
						>
							<CheckboxControl
								value={ attributes.automaticallyAdd }
								onChange={ ( automaticallyAdd ) => {
									setAttributes( { automaticallyAdd } );
									handleCreateFromExistingPages();
								} }
								label={ __( 'Automatically add new pages' ) }
								help={ __( 'Automatically add new top level pages to this navigation.' ) }
							/>
						</PanelBody>
					) }
				</InspectorControls>
				<Placeholder
					className="wp-block-navigation-placeholder"
					icon="menu"
					label={ __( 'Navigation' ) }
					instructions={ __( 'Create a Navigation from all existing pages, or create an empty one.' ) }
				>
					<div className="wp-block-navigation-placeholder__buttons">
						<Button
							isDefault
							className="wp-block-navigation-placeholder__button"
							onClick={ () => setPopulateFromExistingPages( true ) }
							disabled={ ! hasPages }
						>
							{ __( 'Create from all top pages' ) }
						</Button>

						<Button
							isLink
							className="wp-block-navigation-placeholder__button"
							onClick={ handleCreateEmpty }
						>
							{ __( 'Create empty' ) }
						</Button>
					</div>
				</Placeholder>
			</Fragment>
		);
	}

	// UI State: rendered Block UI
	return (
		<Fragment>
			<BlockControls>
				<Toolbar>
					{ navigatorToolbarButton }
				</Toolbar>
				<BlockColorsStyleSelector
					value={ TextColor.color }
					onChange={ TextColor.setColor }
				/>
			</BlockControls>
			{ navigatorModal }
			<InspectorControls>
				{ hasPages && (
					<PanelBody
						title={ __( 'Navigation Settings' ) }
					>
						<CheckboxControl
							value={ attributes.automaticallyAdd }
							onChange={ ( automaticallyAdd ) => setAttributes( { automaticallyAdd } ) }
							label={ __( 'Automatically add new pages' ) }
							help={ __( 'Automatically add new top level pages to this navigation.' ) }
						/>
					</PanelBody>
				) }
				<PanelBody
					title={ __( 'Navigation Structure' ) }
				>
					<BlockNavigationList clientId={ clientId } />
				</PanelBody>
			</InspectorControls>
			<TextColor>
				<div className="wp-block-navigation">
					{ ! hasExistingNavItems && isRequestingPages && <><Spinner /> { __( 'Loading Navigation…' ) } </> }

					<InnerBlocks
						allowedBlocks={ [ 'core/navigation-link' ] }
						templateInsertUpdatesSelection={ false }
						__experimentalMoverDirection={ 'horizontal' }
					/>

				</div>
			</TextColor>
		</Fragment>
	);
}

export default compose( [
	withSelect( ( select, { clientId } ) => {
		const innerBlocks = select( 'core/block-editor' ).getBlocks( clientId );
		return {
			innerBlocks,
			hasExistingNavItems: !! innerBlocks.length,
		};
	} ),
	withDispatch( ( dispatch, { clientId } ) => {
		return {
			updateNavItemBlocks( blocks ) {
				dispatch( 'core/block-editor' ).replaceInnerBlocks( clientId, blocks );
			},
		};
	} ),
] )( Navigation );
