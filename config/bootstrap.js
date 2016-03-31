/**
 * Bootstrap
 *
 * An asynchronous bootstrap function that runs before your Sails app gets lifted.
 * This gives you an opportunity to set up your data model, run jobs, or perform some special logic.
 *
 * For more information on bootstrapping your app, check out:
 * http://sailsjs.org/#documentation
 */
var path = require('path');
var AD = require('ad-utils');
var async = require('async');
module.exports = function(cb) {

    AD.module.permissions(path.join(__dirname, '..', 'setup', 'permissions'), cb);
    // cb(err);   // in case of an unrecoverable error


    // create a listner for when our Activity entries are approved
    ADCore.queue.subscribe('fcf.activities.activity', function(message, data) {

		// data.status    : {string}  'approved'  or 'rejected'
		// data.data      : {obj} any updated values from the ProcessApproval form
		// data.reference : {obj} the reference info we sent


		AD.log('FCF Activity Approval Result:', data);

        // if activity is approved, then pass this on to the Translation Request tool.
        if (data.status == 'approved') {
			// AD.log('... setting approved:');

            var updatedValues = JSON.parse(data.data);
            if (updatedValues) {
                FCFActivity.findOne(data.reference.id)
					.populate('objectives')
					.populate('translations')
					.then(function(activity) {

						// console.log();
						// console.log('----------------------');
						// console.log('... updatedValues:', updatedValues);

						// console.log();
						// console.log('... activity:', activity);
						// console.log();

						Multilingual.model.sync({
							model: activity,
							data: updatedValues
						})
							.fail(function(err) {

							})
							.done(function(updatedActivity) {

								FCFCommonApprovalHandler({
									Model: FCFActivity,
									id: data.reference.id,
									pops: ["objectives", "translations"],
									transType: "activity",
									// sourceLang: updatedValues.language_code || Multilingual.languages.default()
								});

							})


					})

            } else {

                // no values to update, so just pass along call to translations:
                FCFCommonApprovalHandler({
                    Model: FCFActivity,
                    id: data.reference.id,
                    pops: ["objectives", "translations"],
                    transType: "activity"
                });
            }


        } else {

			// AD.log('... not approved?  ', data);
        }


    });


    // create a listner for when our Image entries are approved
    ADCore.queue.subscribe('fcf.activities.image', function(message, data) {

		// data.status    : {string}  'approved'  or 'rejected'
		// data.data      : {obj} any updated values from the ProcessApproval form
		// data.reference : {obj} the reference info we sent


		// AD.log('FCF Image Approval Result:', data);

        // if activity is approved, then pass this on to the Translation Request tool.
        if (data.status == 'approved') {
			// AD.log('... setting approved:');

            var updatedValues = JSON.parse(data.data);
            if (updatedValues) {
                FCFActivityImages.findOne(data.reference.id)
					.populate('translations')
					.populate('taggedPeople')
					.then(function(image) {

						Multilingual.model.sync({
							model: image,
							data: updatedValues
						})
							.fail(function(err) {

							})
							.done(function(updatedActivity) {

								FCFCommonApprovalHandler({
									Model: FCFActivityImages,
									id: data.reference.id,
									pops: ["uploadedBy", "translations"],
									transType: "image"
								});

							})

					})


            } else {

                // no values to update, so pass along translation Request
                FCFCommonApprovalHandler({
                    Model: FCFActivityImages,
                    id: data.reference.id,
                    pops: ["uploadedBy", "translations"],
                    transType: "image"
                });
            }



        } else {

			// AD.log('... not approved?  ', data);
        }
    });



    // create a listner for when our Activities are translated
    ADCore.queue.subscribe('fcf.activities.translated', function(message, data) {

        // data.reference
        // data.language_code   // toLanguage
        // data.fields : {  fieldName: 'translation ', fieldName2:'translation2'}     


        // if data.reference is a string:
        if (typeof data.reference == 'string') {
            data.reference = JSON.parse(data.reference);
        }

        FCFCommonTranslationHandler({
            Model: FCFActivity,
            id: data.reference.id,
            fields: data.fields,
            language_code: data.language_code,
            fieldName: 'activity_name'
        });
		// AD.log('... FCF Activity Translated:', data);

    });


    // create a listner for when our Images are translated
    ADCore.queue.subscribe('fcf.activities.image.translated', function(message, data) {

        // data.reference
        // data.language_code   // toLanguage
        // data.fields : {  fieldName: 'translation ', fieldName2:'translation2'}     


        // if data.reference is a string:
        if (typeof data.reference == 'string') {
            data.reference = JSON.parse(data.reference);
        }

        FCFCommonTranslationHandler({
            Model: FCFActivityImages,
            id: data.reference.id,
            fields: data.fields,
            language_code: data.language_code,
            fieldName: 'caption'
        });
		// AD.log('... FCF Activity Translated:', data);

    });


	// Add fcf activity data source to the report tool
	if (typeof ProcessReport !== 'undefined') {
		var staffDataSource = {};
		var activityDataSource = {};
		var activtyImageDataSource = {};

		async.series([
			function(next) {
				ProcessReport.addDataSource(
					{
						"name": "FCF Staff",
						"schema": {
							"fields": [
								{ "name": "person_id", "type": "number" },
								{ "name": "person_name", "type": "string" },
								{ "name": "person_name_en", "type": "string" },
								{ "name": "person_age", "type": "number" },
								{ "name": "person_nationality", "type": "string" },
								{ "name": "person_passport_number", "type": "string" },
								{ "name": "person_work_number", "type": "string" },
								{ "name": "person_work_address", "type": "string" },
								{ "name": "person_home_address", "type": "string" },
								{ "name": "person_visa_start_date", "type": "date" },
								{ "name": "person_visa_expire_date", "type": "date" },
								{ "name": "person_job_title", "type": "string" },
								{ "name": "person_job_description", "type": "string" },
								{ "name": "person_activites", "type": "string" },
								{ "name": "organization_name", "type": "string" },
								{ "name": "organization_chief_name", "type": "string" },
								{ "name": "organization_chief_position", "type": "string" },
								{ "name": "workplace_name", "type": "string" },
								{ "name": "project_description", "type": "string" }
							]
						}
					},
					["fcf.activities"], "/fcf_activities/renderreport/staffs").then(function(result) {
						staffDataSource = result instanceof Array ? result[0] : result;

						next();
					});
			},
			function(next) {
				ProcessReport.addDataSource(
					{
						"name": "FCF Activities",
						"schema": {
							"fields": [
								{ "name": "person_id", "type": "number" },
								{ "name": "activity_id", "type": "number" },
								{ "name": "activity_name", "type": "string" },
								{ "name": "order", "type": "number" },
								{ "name": "startDate", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" },
								{ "name": "endDate", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" }
							]
						}
					},
					["fcf.activities"], "/fcf_activities/renderreport/activities").then(function(result) {
						activityDataSource = result instanceof Array ? result[0] : result;

						next();
					});
			},
			function(next) {
				ProcessReport.addDataSource(
					{
						"name": "FCF Activity Images",
						"schema": {
							"fields": [
								{ "name": "person_id", "type": "number" },
								{ "name": "activity_id", "type": "number" },
								{ "name": "activity_name", "type": "string" },
								{ "name": "activity_description", "type": "string" },
								{ "name": "activity_start_date", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" },
								{ "name": "activity_end_date", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" },
								{ "name": "activity_image_file_name_left_column", "type": "string" },
								{ "name": "activity_image_caption_left_column", "type": "string" },
								{ "name": "activity_image_file_name_right_column", "type": "string" },
								{ "name": "activity_image_caption_right_column", "type": "string" }
							]
						}
					},
					["fcf.activities"], "/fcf_activities/renderreport/acitivity_images").then(function(result) {
						activtyImageDataSource = result instanceof Array ? result[0] : result;
						next();
					});
			},
			function(next) {
				var staffActivities = {
					"type": "inner",
					"leftKey": "person_id",
					"rightKey": "person_id"
				};
				staffActivities['left'] = staffDataSource.id.toString();
				staffActivities['right'] = activityDataSource.id.toString();

				ProcessReport.addDataSource(
					{
						"name": "FCF Staff and Activities",
						"join": staffActivities
					},
					["fcf.activities"], "/fcf_activities/renderreport/staffs"
				).then(function() { next(); });
			},
			function(next) {
				var staffActivityImages = {
					"type": "inner",
					"leftKey": "person_id",
					"rightKey": "person_id"
				};
				staffActivityImages['left'] = staffDataSource.id.toString();
				staffActivityImages['right'] = activtyImageDataSource.id.toString();

				ProcessReport.addDataSource(
					{
						"name": "FCF Staff and Activity images",
						"join": staffActivityImages
					},
					["fcf.activities"], "/fcf_activities/renderreport/staffs"
				).then(function() { next(); });
			},
		]);

	}

};


function FCFCommonApprovalHandler(options) {
    var Model = options.Model;
    var id = options.id;
    var pops = options.populations || [];
    var transType = options.transType;


    // find the model
    var def = Model.findOne(id);

    // populate all the necessary fields
    pops.forEach(function(key) {
        def.populate(key);
    });

    def.then(function(model) {

        if (model) {
			// AD.log('... found it');
            // set status to 'approved'
            model.status = 'approved';
            model.save()
				.then(function(updatedModel) {
					// AD.log('... updatedActivity:', updatedActivity);
					// Now send this off to be translated:
					FCFActivities.translations[transType](updatedModel);

				})
        } else {

			// should let someone know about this error!
            ADCore.error.log('Error looking up FCFActivity:', { id: data.reference.id });

        }
    })
}


function FCFCommonTranslationHandler(options) {

    var Model = options.Model;
    var id = options.id;
    var fields = options.fields;
    var language_code = options.language_code;
    var fieldName = options.fieldName;

	// get the indicated activity
    Model.findOne(id)
		.populate('translations')
		.then(function(model) {
			// AD.log('... activity:', activity);
			var allDone = true;

			// update the provided translation:
			model.translations.forEach(function(trans) {
				// AD.log('    ... trans:', trans);

				// update current one if it is the one given.
				if (trans.language_code == language_code) {
					_.forOwn(fields, function(value, key) {
						// AD.log('    ... trans key:'+key+'  value:'+value);
						trans[key] = value;
					});
					// AD.log('   ... updatedTrans:', trans);
					trans.save();
				}

				// if current one has our language marker, then we 
				// are not allDone:
				var tag = '[' + trans.language_code + ']';
				if (trans[fieldName].indexOf(tag) == 0) {
					allDone = false;
				}
			})


			// if all translations have been updated
			if (allDone) {

				// mark this activity as 'ready'
				model.status = 'ready';  // 'translated' : if there is going to be another step.
				model.save();
			}

		})
		.catch(function(err) {
			ADCore.error.log('FCFActivities: Can\'t lookup Model from provided reference:', { error: err, options: options, note: 'this is a catch, so it might be catching another error from somewhere else!' });
		})
}


function modelAttributes(options) {
    var model = options.model;
    var Model = options.Model || model._Klass();
    options.type = options.type || 'all';

    var attributes = Model.attributes;

    var fields = [];
    _.forOwn(attributes, function(value, key) {
        if (value.type) {

            if ((options.type == 'all') || (value.type == options.type)) {
				// console.log('   :modelAttributes(): value.type:'+value.type+" options.type:"+options.type);
                fields.push(key);
            }
        }
    })

    return fields;

}


function modelCollections(options) {
    var model = options.model;
    var Model = options.Model || model._Klass();

    var attributes = Model.attributes;

    var fields = [];
    _.forOwn(attributes, function(value, key) {
        if (value.collection) {
            fields.push(key);
        }
    })

    return fields;

}


function modelMultilingualFields(options) {
    var fields = [];

    var model = options.model;
    var Model = options.Model || model._Klass();

    var ModelTrans = modelTransModel(options);

    if (ModelTrans) {


        var attributes = ModelTrans.attributes;

        var ignoreFields = ['id', 'createdAt', 'updatedAt'];
        ignoreFields.push(Model.attributes.translations.via);


        _.forOwn(attributes, function(value, key) {

            if (ignoreFields.indexOf(key) == -1) {
                fields.push(key);
            }
        })
    }

    return fields;
}


function modelTransModel(options) {
    var model = options.model;
    var Model = options.Model || model._Klass();

    if (Model.attributes.translations) {

        var transKey = Model.attributes.translations.collection.toLowerCase();
        return sails.models[transKey];
    }
	console.log('....  ??? no translations:', Model);

    // if we get here then this model doesn't have a translation Model:
    return null;
};