const libPictFlowCard = require('pict-section-flow').PictFlowCard;

/**
 * FlowCard-MappingSource
 *
 * Represents a source dataset in the mapping flow.
 * Output ports are dynamically generated from discovered fields.
 */
class FlowCardMappingSource extends libPictFlowCard
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({},
			{
				Title: 'Mapping Source',
				Name: 'Mapping Source',
				Code: 'SRC',
				Category: 'Data Source',
				Description: 'Source dataset with discovered record fields',
				TitleBarColor: '#2980b9',
				Width: 200,
				Height: 100,
				Inputs: [],
				Outputs:
				[
					{ Name: 'Whole Record', Side: 'right' }
				],
				ShowTypeLabel: true,
				PortLabelsOnHover: false,
				PortLabelsOutside: true
			},
			pOptions);

		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'FlowCardMappingSource';
	}
}

module.exports = FlowCardMappingSource;

module.exports.default_configuration =
{
	Title: 'Mapping Source',
	Code: 'SRC',
	Category: 'Data Source',
	TitleBarColor: '#2980b9',
	Width: 200,
	Height: 100
};
