const libPictFlowCard = require('pict-section-flow').PictFlowCard;

/**
 * FlowCard-SolverExpression
 *
 * A transform card that applies a Fable ExpressionParser solver expression
 * to compute a derived value from the whole incoming record. Connect the
 * Source "Whole Record" output to this card's input, then connect this
 * card's output to a target column.
 *
 * Double-click the node to edit the solver expression in the properties panel.
 *
 * @class FlowCardSolverExpression
 * @extends PictFlowCard
 */
class FlowCardSolverExpression extends libPictFlowCard
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({},
			{
				Title: 'Solver Expression',
				Name: 'Solver Expression',
				Code: 'SOL',
				Category: 'Transform',
				Description: 'Apply a Fable solver expression for conditional logic and computed values',
				TitleBarColor: '#d35400',
				Width: 220,
				Height: 90,
				Inputs:
				[
					{ Name: 'Whole Record', Side: 'left' }
				],
				Outputs:
				[
					{ Name: 'Result', Side: 'right' }
				],
				ShowTypeLabel: true,
				PortLabelsOnHover: false,
				PortLabelsOutside: true,
				LabelsInFront: true,
				Enabled: true,
				BodyContent:
				{
					ContentType: 'html',
					Template: '<div style="font-size:10px; padding:2px 4px; color:var(--theme-color-border-default, #ccc); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:200px;">{~D:Record.Data.SolverExpression~}</div>'
				},
				PropertiesPanel:
				{
					PanelType: 'Template',
					DefaultWidth: 420,
					DefaultHeight: 160,
					Title: 'Solver Expression',
					Configuration:
					{
						Template: '<div style="padding:8px;"><label style="display:block; margin-bottom:4px; font-weight:bold; font-size:12px;">Solver Expression</label><textarea id="FlowCard-SOL-{~D:Record.Hash~}" style="width:100%; height:80px; font-family:monospace; font-size:12px; resize:vertical; background:#1a1a2e; color:var(--theme-color-border-default, #e0e0e0); border:1px solid var(--theme-color-text-secondary, #444); border-radius:4px; padding:6px;" onchange="(function(el){var n=pict.views[\'MeadowMapping-Flow\'];if(n&&n._FlowData){for(var i=0;i<n._FlowData.Nodes.length;i++){if(n._FlowData.Nodes[i].Hash===\'{~D:Record.Hash~}\'){n._FlowData.Nodes[i].Data.SolverExpression=el.value;if(typeof n.renderFlow===\'function\')n.renderFlow();break;}}}})(this)">{~D:Record.Data.SolverExpression~}</textarea><div style="font-size:10px; color:var(--theme-color-text-muted, #888); margin-top:4px;">Example: IF(IncomingRecord.Type == \'Premium\', \'GOLD\', \'SILVER\')</div></div>'
					}
				}
			},
			pOptions);

		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'FlowCardSolverExpression';
	}
}

module.exports = FlowCardSolverExpression;

module.exports.default_configuration =
{
	Title: 'Solver Expression',
	Code: 'SOL',
	Category: 'Transform',
	TitleBarColor: '#d35400',
	Width: 220,
	Height: 90
};
