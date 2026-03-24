const libPictFlowCard = require('pict-section-flow').PictFlowCard;

/**
 * FlowCard-MappingTarget
 *
 * Represents the mapping target table in the mapping flow.
 * Input ports are dynamically generated from schema columns.
 */
class FlowCardMappingTarget extends libPictFlowCard
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({},
			{
				Title: 'Mapping Target',
				Name: 'Mapping Target',
				Code: 'TGT',
				Category: 'Data Target',
				Description: 'Mapping target table with schema columns',
				TitleBarColor: '#27ae60',
				Width: 200,
				Height: 100,
				Inputs:
				[
				],
				Outputs: [],
				ShowTypeLabel: true,
				PortLabelsOnHover: false,
				PortLabelsOutside: true
			},
			pOptions);

		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'FlowCardMappingTarget';
	}
}

module.exports = FlowCardMappingTarget;

module.exports.default_configuration =
{
	Title: 'Mapping Target',
	Code: 'TGT',
	Category: 'Data Target',
	TitleBarColor: '#27ae60',
	Width: 200,
	Height: 100
};
