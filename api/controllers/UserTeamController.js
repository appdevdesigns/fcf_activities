/**
 * UserTeamController
 *
 * @description :: Server-side logic for managing Userteams
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

var AD = require('ad-utils');

module.exports = {
	

    _config: {}

    // Fixture Data:
    // Use this for initial design and testing
    , find:function(req, res) {

        var FinalData = [];
        var listTeams = [];

        var fcfPerson = null;

        async.series([

            // get the user's Person Entry
            function(next) {
// AD.log('... personForSession()');
                FCFCore.personForSession(req)
                .fail(function(err){
                    next(err);
                })
                .then(function(data){
// AD.log('    fcfPerson:', data);
                    fcfPerson = data;
                    next();
                })
            },


            // Now get the list of Ministry Teams for this Person
            function(next) {
// AD.log('... fcfPerson.ministryTeams()');
                if (fcfPerson) {

                    fcfPerson.ministryTeams()
                    .fail(function(err){
                        next(err);
                    })
                    .then(function(lTeams){
                        listTeams = lTeams;
                        next();
                    })

                } else {

                    // apparently the current user isn't setup in our system
                    // respond with an error:
                    var err = new Error('Current user not in our system.');
                    next(err);

                }

            },


            // merge in the names of the People Responsible
            function(next){
// AD.log('... Project.Populate():');
                FCFProject.Populate(listTeams, 'ProjectOwner')
                .fail(function(err){
                    next(err);
                })
                .then(function(){
                    next();
                })

            },


            // now take info and compile into FinalData 
            // we only want:  IDMinistry, MinistryDisplayName, PersonName
            function(next) {

                listTeams.forEach(function(team){
                    var obj = {};
                    obj.IDMinistry = team.IDMinistry;
                    obj.MinistryDisplayName = team.MinistryDisplayName;
                    obj.ProjectOwner = '';
                    if (team.ProjectOwner) {
                        obj.ProjectOwner = team.ProjectOwner.displayName();
                    }

                    FinalData.push(obj);
                })

                next();
            }



        ], function(err, results) {

            if (err) {

                ADCore.comm.error(res, err, 500);
            } else {

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

