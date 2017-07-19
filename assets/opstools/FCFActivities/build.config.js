module.exports = {
	"map": {
		// "dropzone": "js/dropzone/dropzone.min",
  //       "dropzone.css": "js/dropzone/dropzone.min.css"
	},
	"paths": {
		"opstools/FCFActivities": "opstools/FCFActivities/FCFActivities.js"
	},
	"bundle": [
		"opstools/FCFActivities"
	],
	"meta": {
		"opstools/FCFActivities": {
			"deps": [
				"dropzone",		// from OpsPortal
				"js/selectivity/selectivity-jquery.min",
			]
		},
		"js/selectivity/selectivity-jquery.min": {
			"format": "global",
			"deps": [
				"js/selectivity/selectivity-jquery.min.css"
			],
			"sideBundle": true
		},
		// "js/dropzone/dropzone.min": {
		// 	"exports": "Dropzone",
		// 	"format": "global",
		// 	"deps": [
		// 		"js/dropzone/dropzone.min.css"
		// 	],
		// 	"sideBundle": true
		// }
	}
};