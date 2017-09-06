steal(
	'opstools/FCFActivities/models/base/ActivityImage.js',
	function () {
		System.import('appdev').then(function () {
			steal.import('appdev/model/model').then(function () {
				// Namespacing conventions:
				// AD.Model.extend('[application].[Model]', {static}, {instance} );  --> Object
				AD.Model.extend('opstools.FCFActivities.ActivityImage', {
					getCount: 'GET /fcf_activities/activityimagecount',
                                        findOrig: 'GET /fcf_activities/originalactivityimage/{id}'
					/*
							findAll: 'GET /fcf_activities/activityimage/find',
							findOne: 'GET /fcf_activities/activityimage/{id}',
							create:  'POST /fcf_activities/activityimage/create',
							update:  'PUT /fcf_activities/activityimage/update/{id}',
							destroy: 'DELETE /fcf_activities/activityimage/destroy/{id}.json',
							describe: function() {},   // returns an object describing the Model definition
							fieldId: 'fieldName',       // which field is the ID
							fieldLabel:'fieldName'      // which field is considered the Label
					*/
				}, {
						/*
								// Already Defined:
								model: function() {},   // returns the Model Class for an instance
								getID: function() {},   // returns the unique ID of this row
								getLabel: function() {} // returns the defined label value
						*/

						getFullImageUrl: function () {
							return this.image.replace('_scaled.', '.');
						}
					});


			});
		});
	});
