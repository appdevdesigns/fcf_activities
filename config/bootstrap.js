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
var image2base64 = require('image-to-base64');
module.exports = function(cb) {

    // handle our common bootstrap setup instructions:
        // - verify permissions are created
        // - verify opsportal tool definitions are defined.
    AD.module.bootstrap(__dirname, cb);


    // create a listner for when our Activity entries are approved
    ADCore.queue.subscribe('fcf.activities.activity', function(message, data) {

		// data.status    : {string}  'approved'  or 'rejected'
		// data.data      : {obj} any updated values from the ProcessApproval form
		// data.reference : {obj} the reference info we sent


		AD.log('FCF Activity Approval Result:', data);

        // if activity is approved, then pass this on to the Translation Request tool.
        if (data.status == 'approved') {
			// AD.log('... setting approved:');

            var updates = data.data;
            if (updates.length > 0) {
                var updatedValues = JSON.parse(updates);
                FCFActivity.findOne({id:data.reference.id})
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
								menu: data.menu
								// sourceLang: updatedValues.language_code || Multilingual.languages.default()
							});

						})

						return null;


					})

            } else {

                // no values to update, so just pass along call to translations:
                FCFCommonApprovalHandler({
                    Model: FCFActivity,
                    id: data.reference.id,
                    pops: ["objectives", "translations"],
                    transType: "activity",
					menu: data.menu
                });
            }


        } else {

			// AD.log('... not approved?  ', data);
        }


    });


    // create a listner for when our Image entries are approved
    ADCore.queue.subscribe('fcf.activities.image', function(message, data) {
        
        console.log("message: ", message);
        console.log("data: ", data);

		// data.status    : {string}  'approved'  or 'rejected'
		// data.data      : {obj} any updated values from the ProcessApproval form
		// data.reference : {obj} the reference info we sent


		// AD.log('FCF Image Approval Result:', data);

        // if activity is approved, then pass this on to the Translation Request tool.
        if (data.status == 'approved') {
			// AD.log('... setting approved:');
            var updates = data.data;
            if (updates.length > 0) {
                var updatedValues = JSON.parse(updates);
                FCFActivityImages.findOne({id:data.reference.id})
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
								transType: "image",
								menu: data.menu
							});

						});

						return null;

					})


            } else {

                // no values to update, so pass along translation Request
                FCFCommonApprovalHandler({
                    Model: FCFActivityImages,
                    id: data.reference.id,
                    pops: ["uploadedBy", "translations"],
                    transType: "image",
					menu: data.menu
                });
            }


        } else if (data.status == 'rejected') {
            var updates = data.data;
            console.log("data:", data);
            if (updates.length > 0) {
                var updatedValues = JSON.parse(updates);
                FCFActivityImages.findOne({id:data.reference.id})
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

							FCFCommonRejectionHandler({
								Model: FCFActivityImages,
								id: data.reference.id,
								pops: ["uploadedBy", "translations"],
								transType: "image",
								menu: data.menu,
                                comment: data.comment
							});

						});

                        return null;

                    })
                    
                    
            } else {

                // no values to update, so pass along translation Request
                FCFCommonRejectionHandler({
                    Model: FCFActivityImages,
                    id: data.reference.id,
                    pops: ["uploadedBy", "translations"],
                    transType: "image",
                    menu: data.menu,
                    comment: data.comment
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
								{ "name": "person_work_permit_expire_date","type": "date" },
								{ "name": "person_job_title", "type": "string" },
								{ "name": "person_job_description", "type": "string" },
								{ "name": "person_activites", "type": "string" },
								{ "name": "organization_name", "type": "string" },
								{ "name": "organization_chief_name", "type": "string" },
								{ "name": "organization_chief_position", "type": "string" },
								{ "name": "workplace_name", "type": "string" },
								{ "name": "project_title", "type": "string" },
								{ "name": "number_of_approved_images", "type": "number" },
								{ "name": "number_of_approved_activities", "type": "number" }
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
						"name": "FCF active users",
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
								{ "name": "person_work_permit_expire_date","type": "date" },
								{ "name": "person_job_title", "type": "string" },
								{ "name": "person_job_description", "type": "string" },
								{ "name": "person_activites", "type": "string" },
								{ "name": "organization_name", "type": "string" },
								{ "name": "organization_chief_name", "type": "string" },
								{ "name": "organization_chief_position", "type": "string" },
								{ "name": "workplace_name", "type": "string" },
								{ "name": "project_title", "type": "string" },
								{ "name": "number_of_approved_images", "type": "number" },
								{ "name": "number_of_approved_activities", "type": "number" }
							]
						}
					},
					["fcf.activities"], "/fcf_activities/renderreport/activestaffs").then(function(result) {
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
								{ "name": "activity_name_govt", "type": "string" },
								{ "name": "order", "type": "number" },
								{ "name": "startDate", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" },
								{ "name": "endDate", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" },
								{ "name": "project_id", "type": "string" },
								{ "name": "project_name", "type": "string" }
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
								{ "name": "image_id", "type": "number" },
								{ "name": "image_file_name", "type": "string" },
								{ "name": "image_caption_govt", "type": "string" },
								{ "name": "image_caption", "type": "string" },
								{ "name": "image_date", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" },
								{ "name": "person_id", "type": "number" },
								{ "name": "activity_id", "type": "number" },
								{ "name": "activity_name", "type": "string" },
								{ "name": "activity_name_govt", "type": "string" },
								{ "name": "activity_description", "type": "string" },
								{ "name": "activity_description_govt", "type": "string" },
								{ "name": "activity_start_date", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" },
								{ "name": "activity_end_date", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" },
								{ "name": "project_id", "type": "string" },
								{ "name": "project_name", "type": "string" }
							]
						}
					},
					["fcf.activities"], "/fcf_activities/renderreport/activity_images").then(function(result) {
						activtyImageDataSource = result instanceof Array ? result[0] : result;
						next();
					});
			},
			function(next) {
				ProcessReport.addDataSource(
					{
						"name": "FCF Approved Images",
						"schema": {
							"fields": [
								{ "name": "image_id", "type": "number" },
								{ "name": "image_date", "type": "date" },
								{ "name": "person_id", "type": "number" },
								{ "name": "activity_id", "type": "number" },
								{ "name": "activity_start_date", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" },
								{ "name": "activity_end_date", "type": "date", "dateFormat": "YYYY-MM-DDTHH:mm:ss.msZ" },
								{ "name": "project_id", "type": "string" },
								{ "name": "project_name", "type": "string" }
							]
						}
					},
					["fcf.activities"], "/fcf_activities/renderreport/approved_images").then(function (result) {
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
				).then(function(result) { 
					staffAndActivitiesDataSource = result instanceof Array ? result[0] : result;

					next(); 
				});
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
				).then(function(result) {
					staffAndImagesDataSource = result instanceof Array ? result[0] : result;

					next();
				});
			},

		]);

	}

};


function FCFCommonApprovalHandler(options) {
    var Model = options.Model;
    var id = options.id;
    var pops = options.pops || [];
    var transType = options.transType;

// console.log('FCFCommonapprovalhandler: options:', options);

    // find the model
    var def = Model.findOne({ id:id });

    // populate all the necessary fields
    pops.forEach(function(key) {
        def.populate(key);
    });

    def.then(function(model) {

        if (model) {

			// #hack:  Sails v0.12 changes
			// removes existing populations from a model upon .save()
			var oldValues = {};
			pops.forEach(function(key){
				oldValues[key] = model[key];
			})

			// AD.log('... found it');
            // set status to 'approved'
            model.status = 'approved';
            model.save()
				.then(function(updatedModel) {


					// Sails v0.12 update changed behavior of .save()
					// it now no longer keeps populations.
					// do another lookup:
					for (var v in oldValues) {
						model[v] = oldValues[v];
					}

					// Add menu info
					model.menu = options.menu;
// AD.log('... model after .save():', model);
					// Now send this off to be translated:
					FCFActivities.translations[transType](model);
					return null;

				})

        } else {

			// should let someone know about this error!
            ADCore.error.log('Error looking up FCFActivity:', { id: data.reference.id });

        }

        return null;
    })
}

function FCFCommonRejectionHandler(options) {
    var Model = options.Model;
    var id = options.id;
    var pops = options.pops || [];
    var transType = options.transType;
    var comment = options.comment;
    var comments = JSON.parse(comment);
    var image;
    
    console.log("options: ", options);

// console.log('FCFCommonapprovalhandler: options:', options);

    // find the model
    var def = Model.findOne({ id:id });

    // populate all the necessary fields
    pops.forEach(function(key) {
        def.populate(key);
    });

    def.then(function(model) {

        if (model) {

			// #hack:  Sails v0.12 changes
			// removes existing populations from a model upon .save()
			var oldValues = {};
			pops.forEach(function(key){
				oldValues[key] = model[key];
			})

			// AD.log('... found it');
            // set status to 'approved'
            model.status = 'denied';
            model.save()
				.then(function(updatedModel) {
                    
                    image = model.image;
                    
                    FCFPerson.findOne({IDPerson:model.uploadedBy})
                    .then(function(uploader){

                        FCFCMDetails.findOne({IDPerson:comments.deniedBy.IDPerson, codeCMType:"EM"})
    					.then(function(details){
                            
                            comments.deniedBy.email = details.CMDetails.trim();
                            
                            FCFCMDetails.findOne({IDPerson:uploader.IDPerson, codeCMType:"EM"})
        					.then(function(details){
                                console.log(details);
                        
                                var email = details.CMDetails.trim();
                        
                                var nodemailer = require('nodemailer');
                                                    
var template = 
`<!DOCTYPE html>
<html>
<head>
<title>Adroit Photo Denied</title>
</head>
<body style="font-family: Helvetica, sans-serif;background: #3c766a;padding: 0;margin: 0;">
    
    <div class="wrapper" style="margin: 25px;">
        <div class="inner" style="border-radius: 10px;background: white;overflow: hidden;">
            <h3 class="alert" style="margin: 0;padding: 15px;background: url('data:image/jpeg;base64,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dE9wdGlvbnMAAAASAAAAAENwdG5ib29sAAAAAABDbGJyYm9vbAAAAAAAUmdzTWJvb2wAAAAAAENybkNib29sAAAAAABDbnRDYm9vbAAAAAAATGJsc2Jvb2wAAAAAAE5ndHZib29sAAAAAABFbWxEYm9vbAAAAAAASW50cmJvb2wAAAAAAEJja2dPYmpjAAAAAQAAAAAAAFJHQkMAAAADAAAAAFJkICBkb3ViQG/gAAAAAAAAAAAAR3JuIGRvdWJAb+AAAAAAAAAAAABCbCAgZG91YkBv4AAAAAAAAAAAAEJyZFRVbnRGI1JsdAAAAAAAAAAAAAAAAEJsZCBVbnRGI1JsdAAAAAAAAAAAAAAAAFJzbHRVbnRGI1B4bEBSAAAAAAAAAAAACnZlY3RvckRhdGFib29sAQAAAABQZ1BzZW51bQAAAABQZ1BzAAAAAFBnUEMAAAAATGVmdFVudEYjUmx0AAAAAAAAAAAAAAAAVG9wIFVudEYjUmx0AAAAAAAAAAAAAAAAU2NsIFVudEYjUHJjQFkAAAAAAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQmAAAAAAAOAAAAAAAAAAAAAD+AAAA4QklNBA0AAAAAAAQAAAAeOEJJTQQZAAAAAAAEAAAAHjhCSU0D8wAAAAAACQAAAAAAAAAAAQA4QklNJxAAAAAAAAoAAQAAAAAAAAACOEJJTQP1AAAAAABIAC9mZgABAGxmZgAGAAAAAAABAC9mZgABAKGZmgAGAAAAAAABADIAAAABAFoAAAAGAAAAAAABADUAAAABAC0AAAAGAAAAAAABOEJJTQP4AAAAAABwAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAADhCSU0EAAAAAAAAAgAAOEJJTQQCAAAAAAACAAA4QklNBDAAAAAAAAEBADhCSU0ELQAAAAAABgABAAAAAjhCSU0ECAAAAAAAEAAAAAEAAAJAAAACQAAAAAA4QklNBB4AAAAAAAQAAAAAOEJJTQQaAAAAAAM9AAAABgAAAAAAAAAAAAAARQAAAD8AAAAEAGwAbwBnAG8AAAABAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAD8AAABFAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAEAAAAAAABudWxsAAAAAgAAAAZib3VuZHNPYmpjAAAAAQAAAAAAAFJjdDEAAAAEAAAAAFRvcCBsb25nAAAAAAAAAABMZWZ0bG9uZwAAAAAAAAAAQnRvbWxvbmcAAABFAAAAAFJnaHRsb25nAAAAPwAAAAZzbGljZXNWbExzAAAAAU9iamMAAAABAAAAAAAFc2xpY2UAAAASAAAAB3NsaWNlSURsb25nAAAAAAAAAAdncm91cElEbG9uZwAAAAAAAAAGb3JpZ2luZW51bQAAAAxFU2xpY2VPcmlnaW4AAAANYXV0b0dlbmVyYXRlZAAAAABUeXBlZW51bQAAAApFU2xpY2VUeXBlAAAAAEltZyAAAAAGYm91bmRzT2JqYwAAAAEAAAAAAABSY3QxAAAABAAAAABUb3AgbG9uZwAAAAAAAAAATGVmdGxvbmcAAAAAAAAAAEJ0b21sb25nAAAARQAAAABSZ2h0bG9uZwAAAD8AAAADdXJsVEVYVAAAAAEAAAAAAABudWxsVEVYVAAAAAEAAAAAAABNc2dlVEVYVAAAAAEAAAAAAAZhbHRUYWdURVhUAAAAAQAAAAAADmNlbGxUZXh0SXNIVE1MYm9vbAEAAAAIY2VsbFRleHRURVhUAAAAAQAAAAAACWhvcnpBbGlnbmVudW0AAAAPRVNsaWNlSG9yekFsaWduAAAAB2RlZmF1bHQAAAAJdmVydEFsaWduZW51bQAAAA9FU2xpY2VWZXJ0QWxpZ24AAAAHZGVmYXVsdAAAAAtiZ0NvbG9yVHlwZWVudW0AAAARRVNsaWNlQkdDb2xvclR5cGUAAAAATm9uZQAAAAl0b3BPdXRzZXRsb25nAAAAAAAAAApsZWZ0T3V0c2V0bG9uZwAAAAAAAAAMYm90dG9tT3V0c2V0bG9uZwAAAAAAAAALcmlnaHRPdXRzZXRsb25nAAAAAAA4QklNBCgAAAAAAAwAAAACP/AAAAAAAAA4QklNBBEAAAAAAAEBADhCSU0EFAAAAAAABAAAAAI4QklNBAwAAAAACBQAAAABAAAAPwAAAEUAAADAAAAzwAAAB/gAGAAB/9j/7QAMQWRvYmVfQ00AAv/uAA5BZG9iZQBkgAAAAAH/2wCEAAwICAgJCAwJCQwRCwoLERUPDAwPFRgTExUTExgRDAwMDAwMEQwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwBDQsLDQ4NEA4OEBQODg4UFA4ODg4UEQwMDAwMEREMDAwMDAwRDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDP/AABEIAEUAPwMBIgACEQEDEQH/3QAEAAT/xAE/AAABBQEBAQEBAQAAAAAAAAADAAECBAUGBwgJCgsBAAEFAQEBAQEBAAAAAAAAAAEAAgMEBQYHCAkKCxAAAQQBAwIEAgUHBggFAwwzAQACEQMEIRIxBUFRYRMicYEyBhSRobFCIyQVUsFiMzRygtFDByWSU/Dh8WNzNRaisoMmRJNUZEXCo3Q2F9JV4mXys4TD03Xj80YnlKSFtJXE1OT0pbXF1eX1VmZ2hpamtsbW5vY3R1dnd4eXp7fH1+f3EQACAgECBAQDBAUGBwcGBTUBAAIRAyExEgRBUWFxIhMFMoGRFKGxQiPBUtHwMyRi4XKCkkNTFWNzNPElBhaisoMHJjXC0kSTVKMXZEVVNnRl4vKzhMPTdePzRpSkhbSVxNTk9KW1xdXl9VZmdoaWprbG1ub2JzdHV2d3h5ent8f/2gAMAwEAAhEDEQA/AOUWn07pzLK/tGQJrj2t8R+8YWYujsY2rDDKxDQBA+KhykyniwxPCc0xDiH6Merb5WMRDPzE4iY5bGcnAdpT/R4v6vpYnIxm+1tYIGgMD+KY5OOQQahB0OgQRRe5u9tTyzncGkiB/KhQGpgazwtMfB+TraRI68crcuXx/nyT6oRB2iMcOHyHEzbj9MdoadngZJ/iqXUOnHEh7CXVHSTyD5q6+m6sTZW9gOgLmluv9pFzWNs6a4vEljA4fEKnz3Lx5WWKeOUjDJL25wnL3PKUTJvfDuYPPY88MuOEcmGHuwyY4+z/AHozjD0ycBJJJBif/9DlF0mT/Rfk1c2tzDublYPp7ibax7geTGoUOSo5uXyHSGPJEyP7sbj6m3yx4sHN4Y6zzYZDGP3pRjL0/wDPeoxPrljU4tNRrexlVRrfiMrrNL3e6HGxx9Vu7d+k9q53p+czE6lXmvoZaxry40Ee0B0/R/4qf0SqlrmmCCCOyaD4Fb8MeICXDqMg113Dzc8mUkCQIOM7EfLIeD0vWvrVT1DAuxQ197rX7q3XsrZ6Lf8AgTUXb3/mb3rEyf8Akyz/AItV2se4w0EqefusrbhUOJs03ngBo/0iyfiscURgxQIsT9yQ/djEfNL913Pghykc1mnEkSxezD+vkmdIQ/fcNJHycO/GcBYBDuHDUH5oCjjISFxNg9QicJQkYyBjIbgv/9Hl6abL7BXWJc7hWLcazFAvxrd7R7XWM02u/dT9OtrababHBgvYW+oTAbEq5j9Nupsh7h9mB3ueDBdt9zNw/ca5VsubhkRIgAD5SP52P6Wv/ct7l+W9zHEwBlKRIOSJr7vIfJ6f3f0pzbmC/KfQHZIAcfo+O2PzlYVavIDpuLia3nbS1vcDl23+t/4GrBIAJOgHJWZkB4iaEb6Dp/Vd7CR7YAkZ8I+aXzS/r/4TR6tlX0VtbUCA/mwdv5IWbj5AdXdTa4h15Dt5MAkfm2fyXLauvLAxwrNtT/pObrAjnb+c1UTV0bIYHteKQJ9oIaT8WulW8E4xx8MsZ3+eHq9Q24v8Vz+bxTlm44Zo7V7WX0DhlHhlwH9L5/mY4w+0C7EDjZTtG159wrI4a397+uso6ffCv3ZuMyh+Ph1w17QHWHQmPL95Z7uPmPyq3gjIcRIMRKqifm21kf7zm83OBGOIkJygJcU4/J6penHH+4//0svTEdVRjsY6y1o/TOBLXu/Na3VDGR01xL7WvY5sg0yS1x+Sp035RaMapxh5hrdOT4Od9FStwnM+hY207g0hunuPbc72v/sKr7UQanMiR/SiTxS/vfuuh94lKN4sYMI/oTjEwh/Vx/pT/fl/446OG8ZV5yy306cdu2toPl7tw/qlVa+q2DMNtnuqMsDR2bPISybRiY32Fn86dbnCRr9KFWxccXudLtjWDc4wTpMabUIYoETnMegjgh/s/wB7/DXZeYyiWPFjl+tB9zN0HvfuS/Q4cUHZa/fU67AfvE61O4590cOY5ypW9VY1zjVjhlhI379dB226e5Vy6uh7LcSxw90AOIl2sbtP+/o3Wms9Wt4aGWPaTY2dQdNu6EyGGAyCMgZCd8JPpn6P0cn77Jl5nKcMpwkISxcPGI+vHL3PlnhlL+b/ALn7jJ7cTLe0ekcey6Sx0zLv5bP3f3VQNFgv+zkfpNwZHmUWvOsrEhrTaG7G2n6Qb2A/M9qr7nTukzzPdWcUJRJB+XoCeLX/AL1o8xkxzAIH6wm5SEfb9PaUY/p8T//T5ij1PWZ6X85uGz49uVrTTvPpiv7brGrvT3R7tkt9LftXnaSrcxXEL7dOL/xzh/yLf5K+CVfvDfg/8Y4//BX7j1tvqeo71Z9SfdPMo/TfV+1t9IAmDIcSGxH5+2VxaSln/NSvh+Xr8n/N/Ra2K/fjXFfH0r3d/wCv6eN9DrOJvd9mbT9o/wAJvLtvn6e5u36aysj1vWf68+rPunxXIpKLl64jXb9Pi93/AJ3+TbHOcXtxv94/zXB93/8AG/8ALfvPVJLlUlZaL//ZOEJJTQQhAAAAAABVAAAAAQEAAAAPAEEAZABvAGIAZQAgAFAAaABvAHQAbwBzAGgAbwBwAAAAEwBBAGQAbwBiAGUAIABQAGgAbwB0AG8AcwBoAG8AcAAgAEMAUwA1AAAAAQA4QklNBAYAAAAAAAcACAAAAAEBAP/hDtRodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtbG5zOmNycz0iaHR0cDovL25zLmFkb2JlLmNvbS9jYW1lcmEtcmF3LXNldHRpbmdzLzEuMC8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDUzUgV2luZG93cyIgeG1wOkNyZWF0ZURhdGU9IjIwMTUtMDMtMjNUMDk6MDU6NDYrMDg6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDE1LTEwLTA0VDE2OjAxOjQyKzA4OjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDE1LTEwLTA0VDE2OjAxOjQyKzA4OjAwIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjk0REMyNDI2NkU2QUU1MTE4RkIxQjg2ODI0OUQxQjg0IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkM4MTcwQjc0QUE5RTExRTRBMzc4RjA0M0UxQjczQUIzIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6QzgxNzBCNzRBQTlFMTFFNEEzNzhGMDQzRTFCNzNBQjMiIGNyczpBbHJlYWR5QXBwbGllZD0iVHJ1ZSIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6QzgxNzBCNzFBQTlFMTFFNEEzNzhGMDQzRTFCNzNBQjMiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6QzgxNzBCNzJBQTlFMTFFNEEzNzhGMDQzRTFCNzNBQjMiLz4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6OTNEQzI0MjY2RTZBRTUxMThGQjFCODY4MjQ5RDFCODQiIHN0RXZ0OndoZW49IjIwMTUtMTAtMDRUMTY6MDE6NDIrMDg6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDUzUgV2luZG93cyIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6OTREQzI0MjY2RTZBRTUxMThGQjFCODY4MjQ5RDFCODQiIHN0RXZ0OndoZW49IjIwMTUtMTAtMDRUMTY6MDE6NDIrMDg6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDUzUgV2luZG93cyIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPD94cGFja2V0IGVuZD0idyI/Pv/uAA5BZG9iZQBkQAAAAAH/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgMDAwMDAwMDAwMBAQEBAQEBAQEBAQICAQICAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//AABEIAEUAPwMBEQACEQEDEQH/3QAEAAj/xAGiAAAABgIDAQAAAAAAAAAAAAAHCAYFBAkDCgIBAAsBAAAGAwEBAQAAAAAAAAAAAAYFBAMHAggBCQAKCxAAAgEDBAEDAwIDAwMCBgl1AQIDBBEFEgYhBxMiAAgxFEEyIxUJUUIWYSQzF1JxgRhikSVDobHwJjRyChnB0TUn4VM2gvGSokRUc0VGN0djKFVWVxqywtLi8mSDdJOEZaOzw9PjKThm83UqOTpISUpYWVpnaGlq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') 20px 50%/30px 33px no-repeat #40403F;color: #fff;padding-left: 60px;">Your Adroit Activity Photo has been Denied</h3>
            <table cellspacing="0" cellpadding="0" align="center" style="background: #333; max-height: 350px;" class="photo">
                <tr>
                    <td><img src="cid:`+ image +`" style="width: 100%;max-height: 350px;object-fit: contain;margin: 0;padding: 0;"/></td>
                </tr>
            </table>
            <h4 class="fix" style="margin: 0;padding: 15px;background: #dadada;">Log on to Adroit and please fix the following...</h4>
            <ul style="margin: 0;padding: 0px;">`;

if (comments.fixPhoto) {
    template += `<li style="list-style-type: none;margin: 0;padding: 10px 15px;border-top: 1px solid #CCC;">Photo is not appropriate. Please use a different photo.</li>`;
}
if (comments.fixCaption) {
    template += `<li style="list-style-type: none;margin: 0;padding: 10px 15px;border-top: 1px solid #CCC;">Caption needs to be reworded to include both WHAT you are doing and HOW it impacts Thai people.</li>`;
}
if (comments.fixDate) {
    template += `<li style="list-style-type: none;margin: 0;padding: 10px 15px;border-top: 1px solid #CCC;">Date of the photo is not within the current reporting period. Please correct.</li>`;
}
if (comments.fixLocation) {
    template += `<li style="list-style-type: none;margin: 0;padding: 10px 15px;border-top: 1px solid #CCC;">Location is to general. Please provide complete details of the location: Name, Tambon and Ampoe.</li>`;
}
if (comments.customMessage != "") {
    template += `<li style="list-style-type: none;margin: 0;padding: 10px 15px;border-top: 1px solid #CCC;">`+ comments.customMessage +`</li>`;
}
template += `
        </ul>
    </div>
    <a href="https://adroit.appdevdesigns.net" class="button" style="text-decoration: none;background: #f1592a;color: white;padding: 15px;font-size: 1.25em;margin: 20px 0;display: block;border-radius: 5px;text-align: center;">Fix my activity photo</a>
</div>

</body>
</html>`;
                    
                    
                                image2base64(FCFCore.paths.images.activities(image.replace("_scaled", "_print"))) // you can also to use url
                                    .then(
                                        (response) => {
                                            var activityPhotoBuffer = Buffer.from(response, 'base64');
                                            
                                            var mailOptions = {
                                                from: '"Adroit" <adroithelper@fcfthailand.org>',
                                                to: email,
                                                subject: 'Your Adroit Activity Photo has been Denied',
                                                html: template,
                                                replyTo: '"'+comments.deniedBy.display_name+'" '+ comments.deniedBy.email,
                                                attachments: [
                                                    {   // encoded string as an attachment
                                                        filename: image,
                                                        cid: image,
                                                        content: activityPhotoBuffer
                                                    }
                                                ]
                                            };
                                            
                                            console.log("mailOptions: ", mailOptions);

                                            var nodemailer = require("nodemailer");
                                            var transport = nodemailer.createTransport(sails.config.nodemailer);
                                    
                                            transport.sendMail(mailOptions, function(error, info){
                                                if (error) {
                                                    console.log(error);
                                                } else {
                                                    console.log('Email sent: ' + info.response);
                                                }
                                            });
                                        }
                                    )
                                    .catch(
                                        (error) => {
                                            console.log(error); //Exepection error....
                                        }
                                    );

                            })
        					.catch(function(err){
        						ADCore.error.log('fcf_core: Error looking up FCFCMDetails', {
        							error:err,
        							cond:uploader.IDPerson
        						});
        						return null;
        					})
    					})
    					.catch(function(err){
    						ADCore.error.log('fcf_core: Error looking up FCFCMDetails', {
    							error:err,
    							cond:uploader.IDPerson
    						});
    						return null;
    					})

                    })
                    .catch(function(err){
                        AD.log(err);
                    })
                    


					// Sails v0.12 update changed behavior of .save()
					// it now no longer keeps populations.
					// do another lookup:
					for (var v in oldValues) {
						model[v] = oldValues[v];
					}

					// Add menu info
					model.menu = options.menu;
					return null;

				})

        } else {

			// should let someone know about this error!
            ADCore.error.log('Error looking up FCFActivity:', { id: data.reference.id });

        }

        return null;
    })
}


function FCFCommonTranslationHandler(options) {

    var Model = options.Model;
    var id = options.id;
    var fields = options.fields;
    var language_code = options.language_code;
    var fieldName = options.fieldName;

	// get the indicated activity
    Model.findOne({id:id})
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

			return null;

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