steal(
	// List your Page's dependencies here:
	// 'can/control/route'
	// ).then(
	//'opstools/FCFActivities/FCFActivities.css',
	//'opstools/FCFActivities/opsportal-theme-fcf.css',
	'opstools/FCFActivities/controllers/FCFActivities.js',
	function() {
		System.import('appdev').then(function() {
            AD.ui.loading.resources(3);
			AD.ui.loading.completed(3);
		});
		// can.route("#!control/:type");
		// can.route.ready();
	});
