/**
 * ActivityReportController
 *
 * @description :: Server-side logic for managing Userteams
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

var AD = require('ad-utils');
var fs = require('fs');
var path = require('path');


var _allAvatars = [];
var _avatarHash = {};

function allAvatars (cb) {
    if (_allAvatars.length == 0) {
        fs.readdir(FCFCore.paths.images.avatars(''), function(err, avatars){

            if (err) {
                cb(err);
            } else {
                _allAvatars = avatars;

                // turn this into a hash:  
                //  ID    :  Name
                // '0001' : '0001.jpg'
                for (var i = avatars.length - 1; i >= 0; i--) {
                    var parts = avatars[i].split('.');
                    _avatarHash[parts[0]] = avatars[i];
                };

                cb(null, _allAvatars);
            }

        });
    } else {
        cb(null, _allAvatars);
    }
} 


function addAvatar(listPeople, cb) {

    allAvatars(function(err, avatars) {

        if (err) {
            cb(err);
            return;
        }


        // now for each listPerson:
        for (var i = listPeople.length - 1; i >= 0; i--) {
            var person = listPeople[i];
            var id = person.getID();

            // encode the id into a hashID: 0999, 0099, 0009 
            var hashID = '' + id;    // '9'
            var attempt = 1;
            while (attempt <= 4) {
                if (!_avatarHash[hashID]) {
                    hashID = '0'+hashID;  // 09, 009
                    attempt++;
                } else {
                    // found a match so:
                    attempt = 5;  // stop the loop
                }
            }

            if (_avatarHash[hashID]) {

                var foundName = _avatarHash[hashID];
                person.avatar = FCFCore.paths.images.avatars(foundName);

                // remove the path before 'assets'
                person.avatar = person.avatar.split('assets')[1];

            }


        };

        cb();

    });
}




module.exports = {
	

    _config: {},


    // /activityreport/activities/:teamid
    activities:function(req, res) {

        AD.log('<green>::: activityreport.activities() :::</green>');

        // what is the current language_code of the User
        var langCode = ADCore.user.current(req).getLanguageCode();


        var minId = req.param('team');
        // if no minId provided, return an error.
        if (!minId) {

            var err = new Error('No Team provided.');
            ADCore.comm.error(res, err, 500);
            return;
        }



        var listActivities = [];
        var listProjects = [];
        var hashProjects = {};  // minID : [FCFProject]
        var FinalData = [];


        async.series([

            // Find all the activities for the given Team
            // -- only ongoing activities  (date_end == null)
            // -- or have ended no more than 120 days ago
            function(next) {

                AD.log('... finding activities that have ended no more than 120 days ago');
                var fourMonthsAgo = new Date();
                fourMonthsAgo.setDate(fourMonthsAgo.getDate() - 120 )

                FCFActivity.find({team:minId,  'or': [ { date_end: { '>=': fourMonthsAgo }}, { date_end:null}]})
                .populate('translations')
                .populate('team')
                .fail(function(err){
                    next(err);
                })
                .then(function(data){

                    // Translate these entries:
                    data.forEach(function(activity){
                        activity.translate(langCode);
                    })
                    listActivities = data;
                    next();
                })
            },


            // // now lookup the Projects for these Activities
            // // when we are done we want hashProjects [ minID ] = project
            // function(next) {
                
            //     AD.log('... look up all projects for these activities ');
            //     var ids = [];
            //     var tempHash = {};  // projID : minID

            //     // collect all the project id's to look up:
            //     listActivities.forEach(function(activity){
            //         if(activity.team) {
            //             ids.push(activity.team.IDProject);

            //             // a reverse lookup for our projectID : ministryID
            //             tempHash[activity.team.IDProject] = activity.team.IDMinistry;
            //         }
            //     })

            //     // if we have some peojects to lookup:
            //     if ( ids.length > 0) {

            //         FCFProject.find({IDProject:ids})
            //         .then(function(list){

            //             // for each project, populate our hashProjects
            //             list.forEach(function(project){
            //                 var minID = tempHash[project.IDProject];
            //                 hashProjects[ minID ] = project;
            //             })

            //             next();

            //         })
            //         .catch(function(err){
            //             next(err);
            //         })

            //     } else {

            //         next();
            //     }
                

            // },



            // now take info and compile into FinalData 
            // we only want:  id, activity_name, team_name, PersonName
            function(next) {

                AD.log('... flatten for client');
                listActivities.forEach(function(entry){
                    var obj = entry.toClient();  //{};
                    // obj.id = entry.id;
                    // obj.activity_name = entry.activity_name;
                    // obj.team_name = entry.team.MinistryDisplayName;

                    // obj.imageURL = entry.imageURL();
                    
                    // obj.ProjectOwner = '?';
                    // if (hashProjects[entry.team.IDMinistry]) {
                    //     obj.ProjectOwner = hashProjects[entry.team.IDMinistry].displayName(langCode);
                    // }
                    

                    FinalData.push(obj);
                })

                next();
            }



        ], function(err, results) {

            if (err) {

                ADCore.comm.error(res, err, 500);
            } else {

                AD.log('... final data:', FinalData);
                AD.log('<green>::: end activityreport.activities() :::</green>');
                ADCore.comm.success(res, FinalData);
            }

        });
        
    },


    teammembers: function (req, res) {

        // what is the current language_code of the User
        var langCode = ADCore.user.current(req).getLanguageCode();

        var teamID = req.param('teamID');
        var projectID = req.param('projectID');
        var projectIDs = req.param('projectIDs');

        if (!teamID && !projectID && !projectIDs) {

            // if no team provided, just retun empty []
            ADCore.comm.success(res, []);

        } else {

            AD.log('<green>::: activityreport.teammembers() :::</green>');
            var peopleIDs = [];
            var listPeople = null;

            async.series([

                // step1 get all the people references
                function(next) {
                    
                    // return all active volunteers if teamID is 0
                    if (teamID == 0) {
                        FCFMinistryTeamMember.find({codeServiceStatus:"S"})
                        .then(function(list){

                            if (list) {

                                list.forEach(function(entry){
                                    if (entry.IDPerson) {
                                        peopleIDs.push(entry.IDPerson);
                                    }
                                })
                            }

                            next();
                        })
                        .catch(function(err){
                            AD.log(err);
                            next(err);
                        })                        
                    } else if (projectID) {
                        FCFMinistryTeamMember.find({IDProject:projectID, codeServiceStatus:"S"})
                        .then(function(list){

                            if (list) {

                                list.forEach(function(entry){
                                    if (entry.IDPerson) {
                                        peopleIDs.push(entry.IDPerson);
                                    }
                                })
                            }

                            next();
                        })
                        .catch(function(err){
                            AD.log(err);
                            next(err);
                        })
                    } else if (projectIDs) {
                        FCFMinistryTeamMember.find({IDProject:projectIDs, codeServiceStatus:"S"})
                        .then(function(list){

                            if (list) {

                                list.forEach(function(entry){
                                    if (entry.IDPerson) {
                                        peopleIDs.push(entry.IDPerson);
                                    }
                                })
                            }

                            next();
                        })
                        .catch(function(err){
                            AD.log(err);
                            next(err);
                        })
                    } else if (teamID) {
                        FCFMinistryTeamMember.find({IDMinistry:teamID, codeServiceStatus:"S"})
                        .then(function(list){

                            if (list) {

                                list.forEach(function(entry){
                                    if (entry.IDPerson) {
                                        peopleIDs.push(entry.IDPerson);
                                    }
                                })
                            }

                            next();
                        })
                        .catch(function(err){
                            AD.log(err);
                            next(err);
                        })
                    }


                },  

                // step 2: now look up all those people:
                function(next) {

                    AD.log('... looking up people:'+ peopleIDs );

                    FCFPerson.find({IDPerson:peopleIDs}).sort('NameFirstEng ASC and NameLastEng ASC')
                    .then(function(list){

                        list.forEach(function(person){
                            person.display_name = person.displayName(langCode);
                            person.avatar = null; // '/images/activities_person_avatar.jpeg';
                            AD.log('... found teammember:'+ person.display_name);                        
                        })
                        listPeople = list;
                        next();

                    })
                    .catch(function(err){
                        AD.log(err);
                        next(err);
                    })
                },

                // step 3: now verify avatar images and use those:
                function(next) {


                    addAvatar(listPeople, function(err) {
                        next(err);
                    });


                    // // fs.readdir(FCFCore.paths.images.avatars(''), function(err, avatars){
                    // allAvatars(function(err, avatars){

                    //     if (err) {
                    //         next(err);
                    //     } else {

                    //         // turn this into a hash:  
                    //         //  ID    :  Name
                    //         // '0001' : '0001.jpg'
                    //         var hash = {};
                    //         for (var i = avatars.length - 1; i >= 0; i--) {
                    //             var parts = avatars[i].split('.');
                    //             hash[parts[0]] = avatars[i];
                    //         };


                    //         // now for each listPerson:
                    //         for (var i = listPeople.length - 1; i >= 0; i--) {
                    //             var person = listPeople[i];
                    //             var id = person.getID();

                    //             // encode the id into a hashID: 0999, 0099, 0009 
                    //             var hashID = '' + id;    // '9'
                    //             var attempt = 1;
                    //             while (attempt <= 4) {
                    //                 if (!hash[hashID]) {
                    //                     hashID = '0'+hashID;  // 09, 009
                    //                     attempt++;
                    //                 } else {
                    //                     // found a match so:
                    //                     attempt = 5;  // stop the loop
                    //                 }
                    //             }
                    //             // if (id < 1000) {
                    //             //     hashID += '0';  // '0'
                    //             //     if (id < 100) {
                    //             //         hashID += '0'; // '00'
                    //             //         if (id < 10) {
                    //             //             hashID += '0';  // '000'
                    //             //         }
                    //             //     }
                    //             // }
                    //             // hashID += id;

                    //             if (hash[hashID]) {

                    //                 var foundName = hash[hashID];
                    //                 person.avatar = FCFCore.paths.images.avatars(foundName);

                    //                 // remove the path before 'assets'
                    //                 person.avatar = person.avatar.split('assets')[1];

                    //             }


                    //         };

                    //     }

                    //     next();
                    // })
 
                },

                // step 4: now remove all the people who didn't have an avatar
                function(next) {
// console.log('... compile finalList:');
                    var finalList = [];
//                     listPeople.forEach(function(person){
//                         if (person.avatar != null) {
// AD.log('... person had avatar:'+ person.display_name);

//                             finalList.push(person)
//                         } else {
//                             AD.log('... removing member that did not have avatar: '+ person.display_name);
//                         }
//                     });


                    // NOTE: 10 Nov 2016 : decide to add Alfred back in.
                    listPeople.forEach(function(person){
                        if (person.avatar == null) {
// AD.log('... person had avatar:'+ person.display_name);
                            person.avatar = path.join('images', 'fcf_activities', 'icon_person_avatar.jpeg');
                        }

                        finalList.push(person);
                    });


                    listPeople = finalList;
                    next();
                }

            ], function(err, results){

                if (err) {
AD.log('... received error!:', err);
                    ADCore.comm.error(res, err);
                } else {
                    ADCore.comm.success(res, listPeople );
                }

            })

            
        }
    },



    whoami:function(req, res) {

        AD.log('<green>whoami:</green>');

        FCFCore.personForSession(req)
        .fail(function(err){
            AD.log.error('... error finding personForSession():', err);
            ADCore.comm.error(res, err);
        })
        .then(function(data){

            var simplePerson = null;

            if (!data) {
                AD.log.error('... did not match a person');
            } else {
                AD.log('... found');

                simplePerson = {
                    IDPerson:data.IDPerson,
                    display_name: data.displayName()
                }
            }

            
            ADCore.comm.success(res, simplePerson );
        })

    },



    // http://localhost:1337/fcf_activities/activityreport/relevantTags?activities=24&activities=25&activities=26&activities=27&activities=28&activities=29
    relevantTags: function(req, res) {

        AD.log('<green>relevantTags():</green>');

        var activities = req.param('activities');
        AD.log('... activities:'+activities);
        if (!activities) {
            var err = new Error('param[activities] required');
            AD.log.error('... no activity ids provided!');
            ADCore.comm.error(res,err);
            return;
        } 


        // FinalData is a hash of activity_id : [ peopleID, peopleID...]
        var finalData = {};

        // listOldActivities: [] of activity.id for past activities
        var listOldActivities = [];

        // listCurrentActivities: [] of activitiy.id
        var listCurrentActivities = [];


        var dateToday = new Date();
        AD.log('... today\'s date:', dateToday)


        async.series([

            // Step 1) get all activities with end date in the past
            function(next) {
                
                FCFActivity.find({ id:activities, date_end: { '<=': dateToday }})
                .then(function(activities){
                    AD.log('... activities in the past:');
                    activities.forEach(function(a){
                        AD.log('    id:'+a.id+' date_end:'+ a.date_end);
                        listOldActivities.push(a.id)
                    })                   
                    next();
                })
            },


            // step 2) get all activities with end date in future (or null)
            function(next) {
                FCFActivity.find({ id:activities,  'or': [ { date_end: { '>': dateToday }}, { date_end:null}] })
                .then(function(activities){
                    AD.log('... activities current:');
                    activities.forEach(function(a){
                        AD.log('    id:'+a.id+' date_end:'+ a.date_end);
                        listCurrentActivities.push(a.id)
                    })                   
                    next();
                })
            },

            // step 3) now gather all the people in parallel
            function(next) {


                var activityHash = {};  // this is our final Hash of { activityID : [IDPerson,...]}
                var currDate =  new Date(); // today:

                async.parallel([

                    // task 1: handle the old activities
                    function(done) {

                        // if there are none to lookup, then skip
                        if (listOldActivities.length == 0) {

                            done();

                        } else {

                            var fourMonthsAgo = new Date();
                            fourMonthsAgo.setDate(fourMonthsAgo.getDate() - 120 )
                            AD.log('... fourMonthsAgo:', fourMonthsAgo);

                            peopleTaggedInPhotos(activityHash, listOldActivities, fourMonthsAgo)
                            .fail(function(err){
                                AD.log.error('error finding peopleTaggedInPhotos fourMonthsAgo');
                                done(err);
                            })
                            .then(function( hash ) {

                                // convert the peopleID hash to an array of ids
                                for (var id in hash) {
                                    var personHash = hash[id];
                                    var personArry = _.keys(personHash);

                                    finalData[id] = personArry;

                                }

                                done();
                            })
                        }

                    },

                    // task 2: handle the current activities

                    function(done) {

                        // if there are none to lookup, then skip
                        if (listCurrentActivities.length == 0) {

                            done();

                        } else {
                            var twoMonthsAgo = new Date();
                            twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60 )
                            AD.log('... twoMonthsAgo:', twoMonthsAgo);

                            peopleTaggedInPhotos(activityHash, listCurrentActivities, twoMonthsAgo)
                            .fail(function(err){
                                AD.log.error('error finding peopleTaggedInPhotos twoMonthsAgo');
                                done(err);
                            })
                            .then(function( hash ) {

                                // convert the peopleID hash to an array of ids
                                for (var id in hash) {
                                    var personHash = hash[id];
                                    var personArry = _.keys(personHash);

                                    finalData[id] = personArry;
                                }

                                done();
                            })
                        }


                    },

                ], function(error, results) {

                    next();

                })

            }


        ], function(err, results) {

            if (err) {
                AD.log.error(err)
                ADCore.comm.error(res,err);
            } else {
                AD.log('<green>relevantTags done:</green> finalData:', finalData);
                ADCore.comm.success(res, finalData);
            }

        })
        // get activities with end date past
            // get images from 120 days  ago
            // compile all people taged with these images

        // get activities with no end date
            // get images from 60 days ago
            // compile all people tagged with these images

        // for


        var peopleTaggedInPhotos = function( activityHash, activityIDs, afterDate ) {
            var dfd = AD.sal.Deferred();

            // a recursive fn to process a single activityID
            var processCurrent = function(cb) {

                // if there are no more items in our array
                if (activityIDs.length < 1) {
                    // we'er done
                    if (cb) cb();
                } else {

                    // shift off the next activity id
                    var actID = activityIDs.shift();

                    // create a hash to hold all the people ids
                    activityHash[actID] = {};

                    // find all images related to this activity after our date
                    FCFActivityImages.find({ activity:actID, date: {'>=': afterDate }})
                    .populate('taggedPeople')
                    .then(function(images){

                        // for each image returned
                        images.forEach(function(image){

                            // for each person in the image
                            image.taggedPeople.forEach(function(person){

                                // mark that person as tagged
                                activityHash[actID][person.IDPerson] = true;
                            })

                        })

                        // now recurse through this fn() again
                        processCurrent(cb);

                    })

                }
            }


            
            var numDone = 0;

            // start no more than 5 of these in parallel
            // if there are < 5 activityIDs, then only do that many
            var numStarted = 5;
            if (numStarted > activityIDs.length) numStarted = activityIDs.length;

            for(var i=0; i< numStarted; i++) {
                processCurrent(function(){

                    numDone++;
                    // if all of our parallel processes have finished:
                    if (numDone >= numStarted) {

                        // resolve() our data
                        dfd.resolve(activityHash);
                    }
                })
            }


            return dfd
        }

    },


    // /fcf_activities/activityreport/approve/:id
    approveActivity:function(req, res) {

        //// Originally we wanted this in FCFActivities.afterCreate(), but 
        //// moved it here.
        ////
        //// PROBLEM with .afterCreate()
        ////  with a multilingual table (like FCFActivities) the .afterCreate() 
        ////  will be called before any of the related translation entries are 
        ////  created so that is too soon.

        ////  but we need to .translate() the value here, so that the 
        ////  multilingual fields get included in the data being sent to the 
        ////  ProcessApproval tool.

        AD.log('<green>approve activity:</green>');

        // get the id of the activity to approve:
        var id = req.param('id');
        if (!id) {
            var err = new Error('param[id] required');
            AD.log.error(err)
            ADCore.comm.error(res,err);
            return;
        }


        var activity = null;
        var language_code = ADCore.user.current(req).getLanguageCode();
        var creatorGUID = null;
        var objectives = null;
        var creator = null;
        var ministryTeams = null;

        async.series([


            // step 1: translate this activity
            function(next){

                FCFActivity.findOne({id:id})
                .populate('objectives')
                .exec(function(err, modelActivity){

                    if (err) {
// console.log('... .findOne() error:', err);

                        var myErr = new Error('Error loading Activity:');
                        myErr.error = err;
                        next(myErr);
                    } else {
// console.log('... translating');
// console.log('... modelActivity:', modelActivity);

                        if (modelActivity) {

                            activity = modelActivity;
                        
                            // note: .translate() flattens the values to the base object
                            activity.translate(language_code)
                            .fail(function(err){
    // console.log('... .translate() error:', err );

                                var myErr = new Error('Error translating activity.');
                                myErr.error = err;
                                next(myErr);
                            })
                            .then(function(){
    // console.log('... Activity.afterCreate(): translated:', activity);
                                next();
                            })

                        } else {
// console.log('... modelActivity undefined!!!  id:'+id);

                            var myErr = new Error('Error looking up Activity to approve: id:'+id );
                            next(myErr);
                        }

                    }
                })


            },


            // step 2: translate the creator id into site GUID:
            function(next){

                GUID2Person.find({ person:activity.createdBy})
                .exec(function(err, guid){
                    if (err) {
                        var myErr = new Error('Error looking up guid');
                        myErr.error = err;

                        next(myErr);

                    } else {
console.log('... found guid:', guid);
                        creatorGUID = guid[0].guid;
                        next();
                    }
                });
            },

            // step : get actual person object from creator id:
            function(next) {

                FCFPerson.findOne({ IDPerson:activity.createdBy})
                .exec(function(err, person){

                    if (err) {
                        var myErr = new Error('Error looking up activity creator');
                        myErr.error = err;
                        next(myErr);
                    } else {
console.log('... found creator:', person);
                        creator = person;


                        // add an avatar to this person:
                        addAvatar([creator], function(err){
console.log('... creator with avatar:', creator);

                            next(err);
                        })

                    }
                })
            },


            // step : look up ministry teams:
            function(next) {

                creator.ministryTeams()
                .fail(function(err){
                    var myErr = new Error('Error looking up ministry teams:');
                    myErr.error = err;
                    next(myErr);
                })
                .then(function(teams) {
                    ministryTeams = teams;
                    next();
                })
            },


            // step : pull all related objectives for this entry:
            function(next){

                FCFObjective.find({ IDMinistry: activity.team })
                .exec(function(err, list){

                    if (err) {
                        var myErr = new Error('Error looking up objectives');
                        myErr.error = err;

                        next(myErr);

                    } else {
console.log('... found objectives:', list);
                        objectives = list;
                        next();
                    }
                });

            },


            // step : compile the Approval packet:
            function(next){

                // clean up Dates:

                var createdAt = AD.util.moment(activity.createdAt).format('LL');
                activity.date_start = AD.util.moment(activity.date_start).format('LL');
                if (activity.date_end != null){
                    activity.date_end =  AD.util.moment(activity.date_end).format('LL');
                } else {
                    activity.date_end = '';
                }

                var request = {


                    "menu":{
                        "icon":"fa-calendar",
                        "action": {
                          "key":"fcf.activityapproval.newActivity",
                          "context":"opstool-FCFActivities"
                        },
                        "instanceRef":"activity_name",
                        "createdBy":creator.displayName(),
                        "date":createdAt
                    },


                    "form":{
                        "data":activity,
                        "view":"/opstools/FCFActivities/views/FCFActivities/activityApproval.ejs",
                        "viewData":{
                            "objectives":objectives,
                            "language_code":language_code
                        }
                    },


                    "relatedInfo":{
                        "view":"/opstools/FCFActivities/views/FCFActivities/activityApprovalRelated.ejs",
                        "viewData":{
                            "user":{
                                "displayName":creator.displayName(),
                                "avatar":creator.avatar,
                                "teams":ministryTeams
                            },
                            "teamID":activity.team,
                            "createdAt":createdAt
                        }
                    },


                    "callback":{
                        message:"fcf.activities.activity",
                        reference: { id: activity.id }
                    },


                    "permission":{
                        actionKey:'fcf.activities.approve',
                        userID: creatorGUID
                    }

                };

                ADCore.queue.publish('opsportal.approval.create', request);

// AD.log('... Published Request:', request);
                next();


            }


        ], function(err, results){

            if (err) {
                ADCore.error.log('FCF: ActivityReportController.approveActivity(): Error', {
                    error:err,
                    activity:activity
                });
                ADCore.comm.error(res,err);
            } else {
                AD.log('<green>approval sent!</green> ');
                ADCore.comm.success(res, {});
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

