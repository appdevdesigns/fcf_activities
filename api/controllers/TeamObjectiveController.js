/**
 * TeamObjectiveController
 *
 * @description :: Server-side logic for managing Userteams
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

var AD = require('ad-utils');

module.exports = {
	

    _config: {}

    // Return the list of Activities for a given Ministry
    , find:function(req, res) {

        AD.log('TeamObjectives.find():');

        var FinalData = [];
        var listObjectives = null;


        // which IDMinistry are we looking for Activities for?
        var minId = req.param('team');

        // what is the current language_code of the User
        var langCode = ADCore.user.current(req).getLanguageCode();


        // if no minId provided, return an error.
        if (!minId) {

            var err = new Error('No Team provided.');
            ADCore.comm.error(res, err, 500);
            return;
        }


        var projectID = null;

        async.series([

            // <2017-02-24> UPDATE:
            // Objectives are now returned for the Project of a ministry.
            // get the Project from this ministry:
            function(next) {
                FCFMinistry.findOne({IDMinistry:minId})
                .catch(function(err){
                    ADCore.error.log('error looking up FCFMinistry:', {error:err, idMinistry: minId });
                    next(err);
                    return null;
                })
                .done(function(ministry){
                    if (ministry) {
                        projectID = ministry.IDProject;
                        next();
                    } else {
                        ADCore.error.log('FCFActivities:TEamObjectiveController:find() : asked to work with unknown ministry', { idministry: minId });
                        next(new Error('unknown ministry for id:'+minId));
                    }
                    return null;
                })
            },


            // get the user's Person Entry
            function(next) {

                AD.log(`... finding Objectives where IDMinistry:${minId} IDProject:${projectID}`);

                // <2017-02-24> UPDATE:
                // proper lookup is:
                // IDProject: match project of given ministry id
                // IDMinistry: is not null, all project objectives are copied to any 1 sub ministry
                // flgIsActive: 1  -> the objective is currently active.
                FCFObjective.find({IDProject:projectID, IDMinistry:{'!': null}, flgIsActive:1})
                .fail(function(err){
                    next(err);
                })
                .then(function(data){

                    AD.log('... found:', data);
                    listObjectives = data;
                    next();
                })
                .catch(function(err) {
                    AD.log.error('catch: error find(): ', err);
                    next(err);
                });
            },


            // Flatten this out to our essential data:
            function(next) {
                listObjectives.forEach(function(objective){

                    var obj = {};
                    obj.id = objective.IDObjective;
                    obj.description = objective.description(langCode);

                    FinalData.push(obj);
                })

                AD.log('... flattened to: ', FinalData);
                next();

            }

        ], function(err, results) {

            if (err) {

                ADCore.comm.error(res, err, 500);
            } else {
                AD.log('... .success()');
                ADCore.comm.success(res, FinalData);
            }

        });
        
    }

    // , create:function(req, res) {
    //   ADCore.comm.success(res,{ status:'created' })
    // }

    // , update:function(req, res) {
    //   ADCore.comm.success(res,{status:'updated'})
    // }

    // , destroy:function(req, res) {
    //   ADCore.comm.success(res,{status:'destroyed'})
    // }
  
  
};

