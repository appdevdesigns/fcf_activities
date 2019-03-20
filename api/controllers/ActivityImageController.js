/**
 * FCFActivityImageController
 *
 * @description :: Server-side logic for managing Fcfactivityimages
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */
var AD = require('ad-utils');
var path = require('path');
var fs = require('fs');
var lodash = require('lodash');
var _ = require('lodash');
var async = require('async');
var child_process = require('child_process');

var jimp = require('jimp');



///// TODO:
///// Move this into the FCFPerson Model object!


var _allAvatars = [];
var _avatarHash = {};
var _defaultAvatar = path.join('images', 'fcf_activities', 'icon_person_avatar.jpeg');

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


    // get /fcf_activities/activityimage?[filterCondition]
    find:function(req, res) {

// AD.log('-----------------');
// AD.log('params:', req.params);
// AD.log('body:', req.body);
// AD.log('query:', req.query);

        var filter = req.query;


//// TODO: filter off additional params: 
    // "_cas_retry": "23708552",
    // "ticket": "ST-31676-WKdNW3YZMJeDxNOBBcla-cas"
        if(filter.ticket) delete filter.ticket;
        if(filter._cas_retry) delete filter._cas_retry;


        // what is the current language_code of the User
        var langCode = ADCore.user.current(req).getLanguageCode();

        FCFActivityImages.find(filter)
        .populate('translations')
        .populate('uploadedBy')
        .populate('taggedPeople')
        .then(function(list){

            var simpleList = FCFActivityImages.toClientList(list, langCode);
            ADCore.comm.success(res,simpleList);
        }) 
        .catch(function(err){

            ADCore.comm.error(res, err);

            err._model = 'FCFActivityImages';
            err._filter = filter;
            err._langCode = langCode;
            AD.log.error('<bold>error:</bold> error looking up FCFActivityImages', err);

        });

    },


    // get /fcf_activities/activityimage/:id?[filter]
    // normal:  get /fcf_activities/activityimage/:id
    // optional: get /fcf_activities/activityimage/?param=X
    // 
    findOne:function(req, res) {

        var id = req.param('id');

        var filter = req.query;
        if (id) filter.id = id;


        FCFActivityImages.findOne(filter)
        .populate('translations')
        .populate('uploadedBy')
        .populate('taggedPeople')
        .then(function(image){
            image.translate(langCode);
            ADCore.comm.success(res, image.toClient() );
        })
        .catch(function(err){
            ADCore.comm.error(res, err);
            err._model = 'FCFActivityImages';
            err._id = id;
        });

    },

    // get /fcf_activities/originalactivityimage/:id?[filter]
    // normal:  get /fcf_activities/originalactivityimage/:id
    // optional: get /fcf_activities/originalactivityimage/?param=X
    // 
    findOrig:function(req, res) {

        var id = req.param('id');

        var filter = req.query;
        if (id) filter.id = id;


        FCFActivityImages.findOne(filter)
        .populate('translations')
        .then(function(image){
            ADCore.comm.success(res, image );
        })
        .catch(function(err){
            ADCore.comm.error(res, err);
            err._model = 'FCFActivityImages';
            err._id = id;
        });

    },
    
    getActivityAddStatus:function(req, res) {
        var user = ADCore.user.current(req);
        var userID = user.id();
        var roles = [];
        Permission.find({user: userID})
        .populate('role')
        .then(function(plist){

// console.log('... Permissions:', plist);
            plist.forEach(function(i) {
                roles.push(i.role.id);
            });

            PermissionAction.find({action_key:"adroit.activity.upload"})
            .populate('roles')
            .then(function(paList){

// console.log('... Actions:', paList);
// console.log('... look for these roles...', roles);
                var found = false;
                paList[0].roles.forEach(function(i) {
                    if (roles.indexOf(i.id) != -1) {
                        found = true;
                    }
                })

                if (found) {
                    ADCore.comm.success(res, {canAdd: true});
                } else {
                    ADCore.comm.success(res, {canAdd: false});
                }
                return;
            })
            .catch(function(err){
                ADCore.comm.error(res, err);
            });
        })
        .catch(function(err){
            ADCore.comm.error(res, err);
        });
    },

    getCount:function(req, res) {
        var user = ADCore.user.current(req);

        var guid = user.GUID();

        GUID2Person.findOne({guid: guid})
        .then(function(data){
            FCFPerson.findOne({IDPerson: data.person})
            .populate('taggedInImages')
            .then(function(data2){
            	var images = data2.taggedInImages;
            	var curPerImg = 0;
                var prevPerImg = 0;
            	var d = new Date();
                var n = d.getMonth();
                var y = d.getFullYear();
                var startDate = new Date();
                var endDate = new Date();
        	    if (n <= 3) {
                    curStartDate = new Date(y+'-01-01T00:00:00.000Z');
                    curEndDate = new Date(y+'-05-01T00:00:00.000Z');
                    prevStartDate = new Date((y-1)+'-09-01T00:00:00.000Z');
                    prevEndDate = new Date((y-1)+'-012-31T00:00:00.000Z');
                } else if (n <= 7) {
                    curStartDate = new Date(y+'-05-01T00:00:00.000Z');
                    curEndDate = new Date(y+'-09-01T00:00:00.000Z');
                    prevStartDate = new Date(y+'-01-01T00:00:00.000Z');
                    prevEndDate = new Date(y+'-05-01T00:00:00.000Z');
                } else if (n <= 11) {
                    curStartDate = new Date(y+'-09-01T00:00:00.000Z');
                    curEndDate = new Date(y+'-12-31T00:00:00.000Z');
                    prevStartDate = new Date(y+'-05-01T00:00:00.000Z');
                    prevEndDate = new Date(y+'-09-01T00:00:00.000Z');
                }
                images.forEach(function(i) {
                    var imageDate = new Date(i.date);
                    if (imageDate >= curStartDate && imageDate < curEndDate && (i.status == "approved" || i.status == "ready")) {
                        curPerImg++;
                    } else if (imageDate >= prevStartDate && imageDate < prevEndDate && (i.status == "approved" || i.status == "ready")) {
                        prevPerImg++
                    }
                });
                ADCore.comm.success(res, {current: curPerImg, previous: prevPerImg} );
            })
            .catch(function(err){
                ADCore.comm.error(res, err);
                err._model = 'FCFPerson';
                err._id = data.person;
            });
        })
        .catch(function(err) {
          ADCore.comm.error(res, err);
        })

    },
    
    getDenial:function(req, res) {
        
        var id = req.param('id');
        if (!id) {
            AD.comm.error(res, new Error('no id provided'));
            return;
        }
    
        PARequest.find({ uniqueKey: 'fcf.activities.image.' + id })
            .fail(function (err) {
                ADCore.comm.error(res, err);
            })
            .then(function (list) {
                // console.log(list);
                var reasons = JSON.parse(list[0].comment);
                var htmlList = "<ul class='list-group'><li class='list-group-item list-group-item-danger'>This activity image was rejected...please fix the following</li>";
                if (reasons.fixPhoto) {
                    htmlList += "<li class='list-group-item'>" + 'Photo is not appropriate. Please use a different photo.' + "</li>"
                }
                if (reasons.fixCaption) {
                    htmlList += "<li class='list-group-item'>" + 'Caption needs to be reworded to include both WHAT you are doing and HOW it impacts Thai people.' + "</li>"
                }
                if (reasons.fixDate) {
                    htmlList += "<li class='list-group-item'>" + 'Date of the photo is not within the current reporting period. Please correct.' + "</li>"
                }
                if (reasons.fixLocation) {
                    htmlList += "<li class='list-group-item'>" + 'Location is to general. Please provide complete details of the location: Name, Tambon and Ampoe.' + "</li>"
                }
                if (reasons.customMessage != "") {
                    htmlList += "<li class='list-group-item'>" + reasons.customMessage + "</li>"
                }
                htmlList += "</ul>";
                
                ADCore.comm.success(res, htmlList );
            });

        
    },

    create:function(req, res) {


        var fields = ['image', 'activity', 'date', 'caption' ];
        var tags = req.param('taggedPeople');

        // ensure .taggedPeople is an array
        // might be a single string '1492'
        if (!Array.isArray(tags)) {
            tags = [tags];
        }

        var values = {};
        fields.forEach(function(f){
            values[f] = req.param(f);

            if (!values[f]) {
                var err = new Error('Missing required field:'+f);
                ADCore.comm.error(res, err, 400);
                return;
            }
        })
		
		if (req.param('caption_govt'))
			values['caption_govt'] = req.param('caption_govt');

        var newImage = null;
        var finalData = null;

        var languageCode = ADCore.user.current(req).getLanguageCode();
// console.log('*** create image: languageCode:'+languageCode);
        values.language_code = languageCode;
        async.series([

            // 1) figure out who is doing this:
            function(next) {

                FCFCore.personForSession(req)
                .fail(function(err){
                    next(err);
                })
                .then(function(person){
                    values.uploadedBy = person.IDPerson;
                    next();
                })
            },


            // 2) perform a Multilingual.create() on this one:
            function(next) {


                AD.log('... creating ML entry for Activity Image:', values);

                // Save Image entry
                Multilingual.model.create({ model:FCFActivityImages, data: values })
                .then(function(image) {

                    AD.log('... Multilingual.model.created() : ', image);

                    newImage = image;
                    newImage.translate(languageCode)
                    .fail(function(err){

                        ADCore.error.log('Error translating newly created image:', {error: err, image:newImage, languageCode:languageCode });
                        next(err);
                    })
                    .then(function(image){
                        
                        next();
                    })
                    

                })
                .fail(function(err){

                    AD.log('   --- error creating ML data:', err);
                    next(err);
                    
                })


            },


            // 3) relocate the temp image to a proper ActivityImage:
            function(next) {

                // now we have our image id, so:

                if (!newImage) {
                    AD.log.error('error: somehow we lost track of our new image!!!');
                    next(new Error('No New Image!'));
                } else {

                    // 12 Apr 2017
                    // Now we have multiple images due to our rendering.
                    // We need to move them ALL to the new directory, and update newImage.image
                    // with the value of one of the final images.
                    // Seems like we want the web version to be the default?
                    var listRenders = getRenderList();
                    var listAllFiles = [ newImage.image ];
                    var defaultImage = newImage.image;  // use original if no other default set.
                    listRenders.forEach(function(r){
                        var renderFile = newImage.image.replace('.', r.name+'.');
                        listAllFiles.push( renderFile );

                        // if default then choose this one
                        if (r.default) { 
                            defaultImage = renderFile;
                        }
                    })


                    function relocateImages(list, cb) {

                        if (list.length == 0) {
                            cb();
                        } else {

                            var oldFile = list.shift();
                            var newFile = newImage.toSavedFileName(oldFile);
                            FCFCore.files.images.tempToActivity(oldFile, newFile)
                            .fail(function(err){

                                AD.log.error('error: can\'t move file: ['+oldFile+'] -> ['+newFile+']');
                                // remove this entry!
                                newImage.destroy();
                                cb(err);
                                
                            })
                            .then(function(){

                                AD.log('... temp file moved: ['+oldFile+'] -> ['+newFile+']');
                                relocateImages(list, cb);

                            })

                        }

                    }

                    relocateImages(listAllFiles, function(err){

                        // after all that, make sure our newImage.image is our default
                        newImage.toSavedFileName(defaultImage);

                        next(err);
                    });


                    // // relocate the image to actual filesystem location
                    // // Naming Convention:  [Activity.id]_[Image.id]_[uuid].ext
                    // // var newName = [values.activity, '_', newImage.id, '_', values.image].join('');
                    // // 
                    // // NOTE: .toSavedFileName() will internally update the .image to the new name
                    // //       but the instance isn't saved yet.
                    // //       This FCFCore....tempToActivity() has a chance to fail and if it does we
                    // //       don't .save() that name change.
                    // //       else we will .save() the image in the next step.
                    // var newName = newImage.toSavedFileName(values.image);
                    // FCFCore.files.images.tempToActivity(values.image, newName)
                    // .fail(function(err){

                    //     AD.log.error('error: can\'t move file: ['+values.image+'] -> ['+newName+']');
                    //     // remove this entry!
                    //     newImage.destroy();
                    //     next(err);
                        
                    // })
                    // .then(function(){

                    //     AD.log('... temp file moved: ['+values.image+'] -> ['+newName+']');
                    //     next();

                    // })

                }
                
            },


            // 4) update tags for this newImage
            function(next) {

                // relocation successful -> now update name and add tags
                // newImage.image = newName;

                if (tags) {
                    tags.forEach(function(tag){
// console.log('... adding tagged person:'+tag);
                        newImage.taggedPeople.add(tag)
                    })
                }

                newImage.save()
                .then(function(data){

                    if (typeof data == 'undefined') {

// ADCore.error.log('ActivityImageController: newImage.save(): returned data was undefined.', { newImage: newImage })

                        // to prevent losing this transaction, 
                        FCFActivityImages.findOne({id:newImage.id})
                        .populate('translations')
                        .populate('uploadedBy')
                        .populate('taggedPeople')
                        .then(function(image){
                            if (image.translate) { image.translate(languageCode); }
                            finalData = image.toClient(languageCode);
                            next();
                            return null;
                        })
                        .catch(function(err){
                            next(err);
                        })
                        
                    } else {

                        AD.log('... newImage.save() : data:', data);
                        finalData = data.toClient(languageCode);
                        next();
                    }

                })
                .catch(function(err){
console.error(err);
                    AD.log.error('error: can\'t .save() chages to ActivityImage', err);
                    newImage.destroy();
                    next(err);
                });

            },


            // 5) if this is the 1st image for an Activity, then use this image name
            //    for the Activity.defaultImage
            function(next) {

                FCFActivity.findOne({ id: newImage.activity})
                .then(function(activity){

                    if (!activity.default_image) {

                        activity.default_image = newImage.image;
                        activity.save()
                        .then(function(data) {
                            AD.log('... activity.default_image = '+activity.default_image);
                            finalData.default_image = finalData.image; // --> should already be converted to proper path
                            next();
                            return null;
                        })
                        .catch(function(err){
                            AD.log.error('error: updating activity.default_image: activity.save() failed: ', err);
                            next(err);
                            return null;
                        })
                    } else {
                        finalData.default_image = false;  // <-- no update happened.
                        next();
                    }
                    return null;
                })
                .catch(function(err){
                    AD.log.error('error: can\'t FCFActivity.findOne() id:'+newImage.activity+' ', err);
                    next(err);
                    return null;
                })

            }
            

        ], function(err, results) {

            if (err) {
                ADCore.comm.error(res, err);
            } else {
                AD.log('... returning data to client:', finalData);
                ADCore.comm.success(res, finalData );

                // newImage.translate(languageCode)
                // .fail(function(err){

                //  ADCore.error.log('Error translating newly created image:', {error: err, image:newImage, languageCode:languageCode });
                // })
                // .then(function(image){
                    
                    PostApprovalRequest({ data: newImage, action:'created', languageCode:languageCode });
                // })

                
            }

        });

    },

    update:function(req, res) {

        // what is the current language_code of the User
        var langCode = ADCore.user.current(req).getLanguageCode();

        var tags = req.param('taggedPeople');

        var origImage = null;       // {string} name of original image
        var currImage = null;
        var updatedImage = null;

        var isImageSwap = false;    // are they swapping out an image?

        var finalData = null;       // this is what we will send back
        
        var userIsApprover = false;

        var id = req.param('id');
        if (!id) {

            AD.comm.error(res, new Error('no id provided'));
            return;
        }

        async.series([

            // 1) get the current Image instance
            function(next) {

                FCFActivityImages.findOne({ id:id })
                .populate('translations')
                .populate('uploadedBy')
                .populate('taggedPeople')
                .then(function( image ) {

                    currImage = image;
                    currImage.translate(langCode)
                    .fail(function(err){
                        AD.log.error('... failed translating into lang['+langCode+']');
                        next(err);
                    })
                    .then(function(){
                        next();
                    })

                })
                .catch(function(err){
                    next(err);
                })

            },



            // 2) check for updated image reference and remove old image
            function(next) {
                var newImage = req.param('image');

                // remove any provide path section
                newImage = newImage.split('/').pop(); 

                if (typeof newImage == 'undefined') {

                    // no image data was submitted, so move along
                    next();

                } else {

                    // there is image data sent

                    origImage = currImage.image;  // track our original image name

                    // if they are the same
                    if (currImage.image == newImage) {

                        // AD.log('... image reference unchanged.');
                        // nope, they are the same.
                        // move along
                        next();
                        
                    } else {

                        AD.log('... looks like an imageSwap!');
                        // we must be replacing the image
                        // mark that we are doing an imageSwap:
                        isImageSwap = true;

                        next();
                    }
                } 

            },

            // 3.1) Image Swap:  remove current image
            function(next) {

                // if we are not swapping images, then continue
                if (!isImageSwap) {

                    next();

                } else {
                    AD.log('... removing original image ['+ FCFCore.paths.images.activities(currImage.image) + ']' );
                    fs.unlink(FCFCore.paths.images.activities(currImage.image), function(err){

                        // ok so what if there was an error?
                        next();
                    })

                }
            },

            // 3.2) Now move the new file to the right location
            function(next) {


                if (!isImageSwap) {
                    next();
                } else {


                    var newImage = req.param('image');

                    // is this a temp file name?  (ie no '_')
                    if (newImage.indexOf('_') != -1) {

                        // this looks like a converted file already.
                        next();

                    } else {


                        // NOTE: this will also save the new image value to currImage
                        var newName = currImage.toSavedFileName(newImage);

                        AD.log('... swapping image: temp image:'+newImage);
                        AD.log('... swapping image: new image :'+newName);

                        FCFCore.files.images.tempToActivity(newImage, newName)
                        .fail(function(err){

                            AD.log('   ---> failed:', err);
                            // failed transaction!
                            next(err);
    
                        })
                        .then(function(){

                            // ok, file moved so go next:
                            next();
                        });
                    }
                }

            },

            // 4) Did they change the activity for this image?
            function(next) {

                var newActivity = req.param('activity');
                if (newActivity == currImage.activity) {
                    // no change
                    next();
                } else {

                    // move photo to proper new name
                    AD.log('... image ['+currImage.id+'] changed to new activity: from ['+currImage.activity+'] to ['+newActivity+']');

                    var undoImage = currImage.image;  // in case file op goes bad.

                    var currFile = FCFCore.paths.images.activities(currImage.image);
                    var newName = currImage.toSavedFileName();
                    var newFile  = FCFCore.paths.images.activities(newName);

                    FCFCore.files.move(currFile, newfile)
                    .fail(function(err){

                        // transaction failed
                        AD.log.error('    --- renaming file failed!', err);
                        next(err);

                    })
                    .then(function(){

                        next();
                    })
                }

            },


            //

            // 4) check for changes in taggedPeople and update currImage
            function(next) {

                var tags = req.param('taggedPeople');

                if (typeof tags == 'undefined') {

                    // no tags provided, so continue on
                    next();

                } else {

                    // tags represents the official list of who should be tagged

                    var currListTags = []; // collect any tags that didn't get removed.
// AD.log('... given tags:', tags);

// AD.log('... currently tagged people:');
// AD.log(currImage.taggedPeople);
                    // foreach tag in currImage that isn't in provide list -> remove
                    currImage.taggedPeople.forEach(function(person){
// AD.log('... person:', person.IDPerson);
                        // note: the values in tags are strings,
                        // so convert person.IDPerson to string here:
                        var personID = person.IDPerson + '';  
                        if (tags.indexOf(personID) == -1) {
                            AD.log('... removing tag for person['+ person.IDPerson+']');
                            currImage.taggedPeople.remove(person.IDPerson);
                        } else {
                            currListTags.push( personID );
                        }
                    });
// AD.log('... currListTags:', currListTags);

                    // for each provided tag that isn't in our currListTags -> add
                    tags.forEach(function(id){
// AD.log('... tags:', id);
                        if (currListTags.indexOf(id) == -1) {
                            AD.log('... adding tag for person ['+id+']');
                            currImage.taggedPeople.add(id);
                        }
                    })

                    // ok, tags synced!
                    next();

                }

            },
            
            //  4b) get role of user
            function (next) {
                Permissions.getUserRoles(req)
                    .then(function(roles) {

                        var hasApprover = roles.filter(function(role) { return role.name.indexOf("Activity Approver") > -1 })[0];
                        
                        if (hasApprover) {
                            userIsApprover = true;
                        }
                        next();

                    }, function(err){
                        AD.log.error('error: can\'t Permissions.getUserRoles() id:'+currImage.activity+' ', err);
                        next(err);
                    });

            },

            // 5) now update the remaining values and save
            function(next) {

                // var fields = [ 'date', 'caption' ];
		        var newDate = req.param('date');
                if (newDate) {
                    newDate = newDate.trim();

                    // 2017-08-19
                    if (newDate.match(/\d\d\d\d-\d\d-\d\d/)) {

                        var getTimezone = function () {
                            var tzo = -new Date().getTimezoneOffset(),
                                dif = tzo >= 0 ? '+' : '-',
                                pad = function(num) {
                                    var norm = Math.abs(Math.floor(num));
                                    return (norm < 10 ? '0' : '') + norm;
                                };

                            return dif + pad(tzo / 60) + ':' + pad(tzo % 60);
                        }

                        currImage.date = new Date(newDate + 'T00:00:00' + getTimezone());
                    }
                    // remove timezone
                    else if (newDate.indexOf('GMT')) {
                        // 'Wed Jul 19 2017 00:00:00 GMT+1000' to 'Wed Jul 19 2017 00:00:00'
                        currImage.date = new Date(newDate.substring(0, newDate.indexOf('GMT')));
                    }
                    else {
                        currImage.date = new Date(newDate);
                    }

                }
                
                if (userIsApprover) {
                    var status = req.param('status');
                    if (typeof status != "undefined") currImage.status = status;
                }
                
                currImage.save()
                .then(function(savedImg){

                    // this is what we'll send back to the client
                    if ((savedImg) && (savedImg.toClient)) {
                        finalData = savedImg.toClient(langCode);
                    } else {
                        finalData = currImage.toClient(langCode);
                    }

                    // now save any caption change:
                    var newCaption = req.param('caption');
					var newCaptionGovt = req.param('caption_govt');
                    if (newCaption == currImage.caption && newCaptionGovt == currImage.caption_govt) {

                        // no change, so done!
                        next();
                    } else {

                        FCFActivityImagesTrans.findOne({ fcfactivityimages: currImage.id, language_code:langCode })
                        .then(function( trans ){
                            trans.caption = newCaption;
                            finalData.caption = newCaption;

                            trans.caption_govt = newCaptionGovt;
                            finalData.caption_govt = newCaptionGovt;

                            trans.save()
                            .then(function(){

                                // all done!
                                next();
                            })
                            .catch(function(err){
                                AD.log('   --- error saving image translation:', err);
                                next(err);
                            })
                        })
                    }
                })
                .catch(function(err){
                    AD.log('   --- error attempting to save current changes to Activity Image:', err);
                    next(err);
                })

            },


            // 6) if we changed images, and our image was the Activity's default image
            //    update the activity.default_image
            function(next) {

                if (!isImageSwap) {
                    next();
                } else {


                    // get Activity
                    FCFActivity.findOne({ id: currImage.activity})
                    .then(function(activity){

                        if (activity.default_image == origImage ) {

                            AD.log('... image\'s activity.default_image was linked to our old image.');
                            activity.default_image = currImage.image;
                            activity.save()
                            .then(function(data) {
                                AD.log('... activity.default_image = '+data.default_image);
                                finalData.default_image = finalData.image; // --> should already be converted to proper path
                                next();
                            })
                            .catch(function(err){
                                AD.log.error('error: updating activity.default_image: activity.save() failed: ', err);
                                next(err);
                            })
                        } else {
                            finalData.default_image = false;  // <-- no update happened.
                            next();
                        }
                    })
                    .catch(function(err){
                        AD.log.error('error: can\'t FCFActivity.findOne() id:'+currImage.activity+' ', err);
                        next(err);
                    })

                }

            },

            //  7) send a request to approval
            function (next) {
                // When the activity image status is approved or ready and user has approve permission,
                // then it will not request to approve.
                PostApprovalRequest({ data: currImage, action:'updated', languageCode:langCode });

                next();
            }

        ], function(err, results){ 

            if (err) {  
                err._model = 'FCFActivityImages';
                ADCore.comm.error(res, err);
            } else {
                AD.log('... finalData:', finalData);
                AD.log("<green>activityimage.update() finished</green>");
                // res.send(finalData);
                ADCore.comm.success(res,finalData);

                // PostApprovalRequest({ data: currImage, action:'updated', languageCode:langCode });

            }

        })

    },



    destroy:function(req, res) {

        var currImage = null;

        var imageName = null;

        var finalData = {};  

        AD.log('<green>ActivityImageController.destroy()</green>');

        var id = req.param('id');
        if (!id) {

            AD.comm.error(res, new Error('no id provided'));
            return;
        }

        async.series([

            // 1) get the current Image instance
            function(next) {

                AD.log('... finding current Image by id['+id+']');
                FCFActivityImages.findOne({ id:id })
                .populate('taggedPeople')
                .populate('activity')
                .then(function( image ) {

                    currImage = image;
                    imageName = currImage.image;
                    next();

// currImage.translate(langCode)
// .fail(function(err){
//  AD.log.error('... failed translating into lang['+langCode+']');
//  next(err);
// })
// .then(function(){
//  next();
// })

                })
                .catch(function(err){
                    next(err);
                })

            },



            // 2) remove current image
            function(next) {


                AD.log('... removing existing image ['+ FCFCore.paths.images.activities(currImage.image) + ']' );
                fs.unlink(FCFCore.paths.images.activities(currImage.image), function(err){

                    // ok so what if there was an error?
                    next();
                })

            
            },


            // 3) now, if the image's activity is using this image for it's default image
            //    choose another!
            function(next) {

                // get Activity
                var activity = currImage.activity;
                if (!activity) {

                    AD.log.error('our image did not return an activity!  Why?  image:', currImage);
                    next();  // just keep on going for now.
                } else {

                    // if they are not the same, then move along
                    if (activity.default_image != currImage.image) {

                        next();

                    } else {


                        // ok, we need to find another image and choose that one!
//// TODO:  in future we might want to simply emit an event that Activity lost an image
//// TODO:  in future there will be an interface to manage Activity Data and setting an image will be that responsibility
////        we should not have to do this here.

                        AD.log('... this image was the Activity.default_image');
                        FCFActivityImages.find({ id:{ '!':currImage.id }, activity: activity.id })
                        .then(function(list){

                            // if there are other images then choose first image
                            if ((list) && (list.length > 0)) {

                                activity.default_image = list[0].image; 
                            } else {

                                // else return to null
                                activity.default_image = null;
                                AD.log('... no other images found')
                            }

                            AD.log("... updating default_image:"+activity.default_image);
                            activity.save()
                            .then(function(a) {

                                finalData.default_image = a.imageURL();

                                // all done
                                next();
                            })
                            .catch(function(err) {
                                AD.log.error('error: cant save activity change. ', err);

                                // next(err);
                                next();  // <-- just move along for now since this is a secondary issue!
                            })
                        })
                        .catch(function(err){

                            AD.log.error('error: cant find additional images for activity:', err, activity);
                            // next(err);
                            next();
                        })
                    }
                }
            },

            


            // 4) now destroy the image translations
            function(next) {

                AD.log('... removing image translations');

                FCFActivityImagesTrans.destroy({ fcfactivityimages: currImage.id })
                .then(function( trans ){

                    AD.log('... removing the image entry');

                    // and now the actual image entry!
                    currImage.destroy()
                    .then(function(removedImg){

                        next();

                    })
                    .catch(function(err){
                        AD.log('   --- error attempting to destroy() Activity Image:', err);
                        next(err);
                    })
    
                })
                .catch(function(err){
                    AD.log.error('   --- error removing image translations');
                    next(err);
                })

            }




        ], function(err, results){ 

            if (err) {  
                err._model = 'FCFActivityImages';
                ADCore.comm.error(res, err);
            } else {

                AD.log('<green> activityimage.delete() complete. </green>');
                ADCore.comm.success(res, finalData );
            }

        })
    },
    
    
    
    
    upload: function(req, res) {
        req.file('imageFile').upload({}, function(err, uploadList) {
            
            if (err) {
                ADCore.comm.error(res, err);
            } 
            else {
                
                var tempFile = uploadList[0].fd;
                var imageName = path.basename(tempFile);
                var processPath = process.cwd();
                
                // Web path to the image
                var targetPathWeb = path.join('data', 'fcf', 'images', 'temp');
                // Filesystem path to the image
                var targetPath = path.join(processPath, 'assets', targetPathWeb);
                
                // There is a timeout by the browser and/or proxy server after
                // about 2 minutes of inactivity. The following allows us to
                // take  more time for image processing.
                var isFinished = false;
                var interval = null;
                // send whitespace to keep connection alive
                interval = setInterval(() => {
                    if (!isFinished) {
                        console.log("just wait...")
                        res.write(' ');
                    }
                }, 20000);
                
                // Process image and save to target directory
                var listRenders = getRenderList();
                processImageFile(listRenders, tempFile, targetPath)
                .then(() => {
                    clearInterval(interval);
                    isFinished = true;
                    res.AD.success({ 
                        path: path.join(targetPathWeb, imageName), 
                        name: imageName 
                    }, null, true);
                })
                .catch((err) => {
                    ADCore.error.log(
                        "FCFActivities:ActivityImageController:upload() Error Rendering File.", 
                        { 
                            error: err, 
                            newFile: tempFile 
                        }
                    );  
                    clearInterval(interval);
                    isFinished = true;
                    res.AD.error(err, 500);
                });
                
            }
        })
    },
    


    // get /fcf_activities/mobile/myactivityimages?[filter]
    //
    // gets all ActivityImages for the current logged in user.
    //
    // [filter]:  you can add on a sails like query filter for the ActivityImage to 
    // further condition which ActivityImages you want:
    mobileMyImages:function(req, res) {


        var user = ADCore.user.current(req);

        var guid = user.GUID();

        var filter = req.query;

        if(filter.ticket) delete filter.ticket;
        if(filter._cas_retry) delete filter._cas_retry;

        delete filter.uploadedBy;  // not allowed to specify uploaded by.


        GUID2Person.findOne({guid: guid})
        .then(function(data){

            if (!data) {
                var err = new Error('No Person found for this user.');
                console.error(err);
                res.AD.error(err);
                return;
            }


            // default: find Activity images uploaded by person.
            filter.uploadedBy = data.person;


            var allActivities = [];
            var relatedTeams = [];

            async.series([

                // find all the images the current person is tagged in
                (next)=>{

                    FCFPerson.findOne({IDPerson:data.person})
                    .populate('taggedInImages')
                    .then((person)=>{

                        // if tagged in other images, then return all those
                        var taggedIDs = (person.taggedInImages || []).map(i=>{return i.id});
                        if (taggedIDs.length > 0) {
                            filter.id = taggedIDs;
                            delete filter.uploadedBy;
                        } 
                        
                        next();
                    })
                    .catch(next);
                },


                // find the Activities
                (next)=>{

                    FCFActivityImages.find(filter)
                    .populate('activity')
                    .populate('translations')
                    .populate('taggedPeople')
                    .then((list)=>{

                        allActivities = list;

                        // use toClient() logic to get these fields:
                        var copyFields = ['caption', 'caption_govt', 'image'];
                        allActivities.forEach((a)=>{
                            var simpleA = a.toClient('en');
                            copyFields.forEach((f)=>{
                                a[f] = simpleA[f];
                            })
                            // simplify the tagged people lists while we are at it
                            var simplePeople = [];
                            a.taggedPeople.forEach((t)=>{
                                var display_name = t.NameFirstEng + " " + t.NameLastEng;
                            
                                var simplePerson = {
                                    IDPerson: t.IDPerson,
                                    display_name: display_name
                                };
                                simplePeople.push(simplePerson);
                            
                            });
                            a.taggedPeople = undefined; // we cannot delete but we can empty it at least
                            a.tagged_people = simplePeople;
                        })

                        next();
                    })
                    .catch(next);

                },

                // lookup activities translations:
                (next)=>{

                    var activityIDs = allActivities.map((a)=>{ return a.activity.id; })
                    FCFActivity.find({id:activityIDs})
                    .populate('translations')
                    .then((list)=>{

                        var translateIt = (indx, cb) => {
                            if (indx >= list.length) {
                                cb();
                            } else {

                                var entry = list[indx];
                                if (entry.translations.length) {
                                    entry.translate('en')
                                    .then(()=>{
                                        translateIt(indx+1, cb);
                                    })
                                    .fail(cb);
                                } else {
                                    cb();
                                }
                            }
                        }

                        translateIt(0, (err)=>{

                            if (err) {
                                next(err);
                                return;
                            }

                            // list is the translated activities:
                            // create a quick lookup hash:
                            var hashActivities = {};
                            list.forEach((l)=>{
                                hashActivities[l.id] = {
                                    id: l.id,
                                    team: l.team,
                                    activity_name:l.activity_name
                                }
                            })

                            // replace the .activity with our shortened version:
                            allActivities.forEach((a)=>{
                                a.activity = hashActivities[a.activity.id];
                            })

                            next();
                        })
                    })
                },


                // find the related Teams:
                (next)=>{

                    var teamIDs = allActivities.map((a)=>{ return a.activity.team; });
                    FCFMinistry.find({IDMinistry:teamIDs})
                    .then((list)=>{
                        relatedTeams = list;
                        next();
                    })
                    .catch(next);
                },


                // merge team info into Activity List
                (next)=>{

                    var hashTeams = {};
                    relatedTeams.forEach((t)=>{
                        hashTeams[t.IDMinistry] = t;
                    })

                    allActivities.forEach((a)=>{
                        if (typeof a.activity.team == "number") {
                            var team = hashTeams[a.activity.team];
                            
                            // only want a subset here
                            a.activity.team = {
                                IDMinistry: team.IDMinistry,
                                MinistryDisplayName: team.MinistryDisplayName
                            };
                        }
                    })

                    next();
                },

                // merge denied info into Activity List
                (next)=>{

                    var rejectedPhotos = [];
                    allActivities.forEach((a)=>{
                        if (a.status == "denied") {
                            rejectedPhotos.push('fcf.activities.image.' +a.id);
                        }
                    })
                    PARequest.find({ uniqueKey: rejectedPhotos })
                        .fail(function (err) {
                            console.error('!!! Dang.  something went wrong:', err);
                        })
                        .then(function (list) {
                            allActivities.forEach((a)=>{
                                if (a.status == "denied") {
                                    list.forEach((pa)=>{
                                        if (pa.uniqueKey == 'fcf.activities.image.' + a.id) {
                                            if (pa.comment)
                                                a.feedback = JSON.parse(pa.comment);
                                        }
                                    })
                                }
                            })
                            
                            next();
                        });
                },


            ], (err, data)=>{

                if (err) {
                    res.AD.error(err, 500);  
                    return;
                }


                res.AD.success(allActivities);

            })
            


        })
        .catch((err)=>{
            ADCore.error.log("FCFActivities:ActivityImageController:mobileMyImages() Error Finding User.", { error:err, user:user, guid:guid });  
            res.AD.error(err, 500);
        })
    },


    // get /fcf_activities/mobile/myteams?[filter]
    //
    // gets all Teams for the current logged in user.
    //
    // Related Team Activities and Members are also included.
    //
    // [filter]:  you can add on a sails like query filter for the Teams to 
    // further condition which Teams you want:
    mobileMyTeams:function(req, res) {



        var user = ADCore.user.current(req);

        var guid = user.GUID();
        var PersonID = null;

        var filter = req.query || {};
        if(filter.ticket) delete filter.ticket;
        if(filter._cas_retry) delete filter._cas_retry;


        var allTeams = [];  // collect all the Teams to return;
        var hashActivities = {}; // 

        async.series([

            // find the Person for the logged in user
            (next)=>{

                GUID2Person.findOne({guid: guid})
                .then(function(data){

                    if (!data) {
                        var err = new Error('No Person found for this user.');
                        err.responseCode = 404;
                        next(err);
                        return;
                    }

                    PersonID = data.person;
                    next();

                })
                .catch(next);

            },

            // find the Teams (ministries) this Person is in.
            (next)=>{

                // limit to found person

                FCFMinistryTeamMember.find({IDPerson:PersonID})
                .then((list)=>{

                    // if "null" is sent as a filter value
                    Object.keys(filter).forEach((k)=>{
                        if (filter[k] == "null") {
                            filter[k] = null; 
                        }
                    })
                    filter.IDMinistry = list.map((l)=>{return l.IDMinistry;});

                    FCFMinistry.find(filter)
                    .populate('activities')
                    .sort('MinistryDisplayName ASC')
                    .then((list)=>{

                        // convert to small team reference:
                        list.forEach((l)=>{
                            allTeams.push({
                                IDMinistry: l.IDMinistry,
                                MinistryDisplayName: l.MinistryDisplayName,
                                activities: l.activities
                            })
                        })
                        next();
                    })
                    .catch(next);


                })
                .catch(next);

            },

            // lookup activities translations:
            (next)=>{

                var activityIDs = [];
                allTeams.forEach((t)=>{ 
                    t.activities.forEach((a)=>{
                        activityIDs.push(a.id);
                    }) 
                })

                FCFActivity.find({id:activityIDs})
                .populate('translations')
                .then((list)=>{

                    var translateIt = (indx, cb) => {
                        if (indx >= list.length) {
                            cb();
                        } else {

                            var entry = list[indx];
                            if (entry.translations.length) {
                                entry.translate('en')
                                .then(()=>{
                                    translateIt(indx+1, cb);
                                })
                                .fail(cb);
                            } else {
                                cb();
                            }
                        }
                    }

                    translateIt(0, (err)=>{

                        if (err) {
                            next(err);
                            return;
                        }

                        // list is the translated activities:
                        // create a quick lookup hash:
                        list.forEach((l)=>{
                            hashActivities[l.id] = {
                                id: l.id,
                                activity_name:l.activity_name,
                                date_start:l.date_start
                            }
                        })

                        next();
                    })
                })
            },

            // reduce .activities to subset:
            (next) =>{

                allTeams.forEach((t)=>{
                    var theseActivities = [];
                    t.activities.forEach((a)=>{
                        theseActivities.push(hashActivities[a.id])
                    })

                    // sort theseActivities by activity_name:
                    var orderedActivities = _.orderBy(theseActivities, ['date_start', 'activity_name'], ['desc', 'asc']);
                    t.activities = orderedActivities;
                })

                next();
            },

            // add the members for each team
            (next)=>{

                var tempListOfTeams = [];  // create a new array since our findMembers() .shift()s entries off
                var hashTeams = {};
                allTeams.forEach((t)=>{ 
                    t.members = [];
                    tempListOfTeams.push(t);
                    hashTeams[t.IDMinistry] = t;
                })


                function findMembers(list, cb) {
                    if (list.length == 0) {
                        cb();
                    } else {

                        var team = list.shift();
                        FCFMinistryTeamMember.find({IDMinistry:team.IDMinistry})
                        .then((listMembers)=>{

                            var memberIDs = listMembers.map((tm)=>{ return tm.IDPerson; });
                            FCFPerson.find({IDPerson:memberIDs})
                            .then((listPersons)=>{

                                // local fn() to add the avatar info for each person:
                                addAvatar(listPersons, function(err) {

                                    if (err) {
                                        cb(err);
                                        return;
                                    }

                                    var listSmallEntries = [];
                                    listPersons.forEach((P)=>{
                                        listSmallEntries.push({
                                            IDPerson:P.IDPerson,
                                            avatar:P.avatar || _defaultAvatar,
                                            display_name:P.displayName('en')
                                        })
                                    })
                                    hashTeams[team.IDMinistry].members = listSmallEntries;
                                    findMembers(list, cb);

                                })
                                
                            })
                            .catch(cb);
                            
                        })
                        .catch(cb);

                    }
                }

                findMembers(tempListOfTeams, function(err){
                    next(err);
                })

            }

        ], (err, data)=>{

            if (err) {
                res.AD.error(err, err.responseCode || 500);  
                return;
            }

            res.AD.success(allTeams);
        })

    },
    
    // get /fcf_activities/mobile/myprojects?[filter]
    //
    // gets all Projects and Teams for the current logged in user.
    //
    // Related Team Activities and Members are also included.
    //
    // [filter]:  you can add on a sails like query filter for the Teams to 
    // further condition which Teams you want:
    mobileMyProjects:function(req, res) {



        var user = ADCore.user.current(req);

        var guid = user.GUID();
        var PersonID = null;

        var filter = req.query || {};
        if(filter.ticket) delete filter.ticket;
        if(filter._cas_retry) delete filter._cas_retry;


        var allProjects = []; // collect Projects to store teams in;
        var allTeams = [];  // collect all the Teams to return;
        var hashActivities = {}; // 

        async.series([

            // find the Person for the logged in user
            (next)=>{

                GUID2Person.findOne({guid: guid})
                .then(function(data){

                    if (!data) {
                        var err = new Error('No Person found for this user.');
                        err.responseCode = 404;
                        next(err);
                        return;
                    }

                    PersonID = data.person;
                    next();

                })
                .catch(next);

            },
            
            // find the Projects this Person is in.
            (next)=>{

                // limit to found person

                FCFMinistryTeamMember.find({IDPerson:PersonID, codeServiceStatus:"S"})
                .then((list)=>{

                    // if "null" is sent as a filter value
                    Object.keys(filter).forEach((k)=>{
                        if (filter[k] == "null") {
                            filter[k] = null; 
                        }
                    })

                    filter.IDProject = list.map((l)=>{return l.IDProject;});
                    
                    console.log(filter);
                    
                    FCFProject.find(filter)
                    .sort('ProjectNameEng ASC')
                    .then((list)=>{

                        // convert to small team reference:
                        list.forEach((l)=>{
                            allProjects.push({
                                IDProject: l.IDProject,
                                ProjectName: l.ProjectNameEng
                            })
                        });
                        console.log(allProjects);
                        next();
                        
                    })
                    .catch(next);

                })
                .catch(next);

            },

            // find the Teams (ministries) this Person is in.
            (next)=>{

                // limit to found person
                FCFMinistryTeamMember.find({IDPerson:PersonID, codeServiceStatus:"S"})
                .then((list)=>{

                    // if "null" is sent as a filter value
                    Object.keys(filter).forEach((k)=>{
                        if (filter[k] == "null") {
                            filter[k] = null; 
                        }
                    })
                    filter.IDMinistry = list.map((l)=>{return l.IDMinistry;});
                    
                    FCFMinistry.find(filter)
                    .populate('activities')
                    .sort('MinistryDisplayName ASC')
                    .then((list)=>{

                        // convert to small team reference:
                        list.forEach((l)=>{
                            allTeams.push({
                                IDMinistry: l.IDMinistry,
                                MinistryDisplayName: l.MinistryDisplayName,
                                IDProject: l.IDProject,
                                activities: l.activities
                            })
                        })
                        console.log(allTeams);
                        next();
                    })
                    .catch(next);


                })
                .catch(next);

            },

            // lookup activities translations:
            (next)=>{

                var activityIDs = [];
                allTeams.forEach((t)=>{ 
                    t.activities.forEach((a)=>{
                        activityIDs.push(a.id);
                    }) 
                })

                console.log(activityIDs);

                FCFActivity.find({id:activityIDs})
                .populate('translations')
                .then((list)=>{

                    console.log(list);
                    var translateIt = (indx, cb) => {
                        if (indx >= list.length) {
                            cb();
                        } else {

                            var entry = list[indx];
                            if (entry.translations.length) {
                                entry.translate('en')
                                .then(()=>{
                                    translateIt(indx+1, cb);
                                })
                                .fail(cb);
                            } else {
                                cb();
                            }
                        }
                    }

                    translateIt(0, (err)=>{

                        if (err) {
                            next(err);
                            return;
                        }

                        // list is the translated activities:
                        // create a quick lookup hash:
                        list.forEach((l)=>{
                            hashActivities[l.id] = {
                                id: l.id,
                                activity_name:l.activity_name,
                                date_start:l.date_start
                            }
                        })

                        next();
                    })
                })
            },

            // reduce .activities to subset:
            (next) =>{
                
                allTeams.forEach((t)=>{
                    var theseActivities = [];
                    t.activities.forEach((a)=>{
                        theseActivities.push(hashActivities[a.id])
                    })

                    // sort theseActivities by activity_name:
                    var orderedActivities = _.orderBy(theseActivities, ['date_start', 'activity_name'], ['desc', 'asc']);
                    t.activities = orderedActivities;
                })

                next();
            },
            
            // add the members for each project
            (next)=>{

                var tempListOfProjects = [];  // create a new array since our findMembers() .shift()s entries off
                var hashProjects = {};
                allProjects.forEach((p)=>{ 
                    p.members = [];
                    tempListOfProjects.push(p);
                    hashProjects[p.IDProject] = p;
                });

                function findMembers(list, cb) {
                    if (list.length == 0) {
                        cb();
                    } else {

                        var project = list.shift();
                        FCFMinistryTeamMember.find({IDProject:project.IDProject, codeServiceStatus:"S"})
                        .then((listMembers)=>{

                            var memberIDs = listMembers.map((tm)=>{ return tm.IDPerson; });
                            FCFPerson.find({IDPerson:memberIDs})
                            .sort('NameFirstEng ASC and NameLastEng ASC')
                            .then((listPersons)=>{

                                // local fn() to add the avatar info for each person:
                                addAvatar(listPersons, function(err) {

                                    if (err) {
                                        cb(err);
                                        return;
                                    }

                                    var listSmallEntries = [];
                                    listPersons.forEach((P)=>{
                                        listSmallEntries.push({
                                            IDPerson:P.IDPerson,
                                            avatar:P.avatar || _defaultAvatar,
                                            display_name:P.displayName('en')
                                        })
                                    })
                                    hashProjects[project.IDProject].members = listSmallEntries;
                                    findMembers(list, cb);

                                })
                                
                            })
                            .catch(cb);
                            
                        })
                        .catch(cb);

                    }
                }

                findMembers(tempListOfProjects, function(err){
                    next(err);
                })

            },

            // add the members for each team
            (next)=>{

                var tempListOfTeams = [];  // create a new array since our findMembers() .shift()s entries off
                var hashTeams = {};
                allTeams.forEach((t)=>{ 
                    t.members = [];
                    tempListOfTeams.push(t);
                    hashTeams[t.IDMinistry] = t;
                });

                function findMembers(list, cb) {
                    if (list.length == 0) {
                        cb();
                    } else {

                        var team = list.shift();
                        FCFMinistryTeamMember.find({IDMinistry:team.IDMinistry})
                        .then((listMembers)=>{

                            var memberIDs = listMembers.map((tm)=>{ return tm.IDPerson; });
                            FCFPerson.find({IDPerson:memberIDs})
                            .sort('NameFirstEng ASC and NameLastEng ASC')
                            .then((listPersons)=>{

                                // local fn() to add the avatar info for each person:
                                addAvatar(listPersons, function(err) {

                                    if (err) {
                                        cb(err);
                                        return;
                                    }

                                    var listSmallEntries = [];
                                    listPersons.forEach((P)=>{
                                        listSmallEntries.push(P.IDPerson)
                                    })
                                    hashTeams[team.IDMinistry].memberIDs = listSmallEntries;
                                    findMembers(list, cb);

                                })
                                
                            })
                            .catch(cb);
                            
                        })
                        .catch(cb);

                    }
                }

                findMembers(tempListOfTeams, function(err){
                    next(err);
                })

            },
            
            // Put the teams into the projects
            (next)=>{
                
                console.log("_____________________________ here here _____________________________________");

                allProjects.forEach((p)=>{
                    
                    p.teams = [];
                    
                    allTeams.forEach((t)=>{
                        
                        if (p.IDProject == t.IDProject) {
                            p.teams.push(t);
                        }
                        
                    });
                    
                });
                
                next();
                
            }

        ], (err, data)=>{

            if (err) {
                res.AD.error(err, err.responseCode || 500);  
                return;
            }

            res.AD.success(allProjects);
        })

    }
    
};






var ImageRenders = [

    // Web Site Version
    // 160x120
    {
        name: '_scaled',
        quality:40,
        width: 160,
        height: 120,
        'default': true     // use this version by default
    },

    // Print Versions
    // 3.5"(h) x 5"(w) @ 300dpi:
    // 1500(w)x1050(h)
    {
        name: '_print',
        quality:60,
        width: 1500,
        height: 1050,
        'default':false
    }
]


/*
 * @function getRenderList
 *
 * return the list of render options for this site.
 *
 * the output of the render'ed file will match the original Filename
 * + a render.name tag at the end.
 *
 * @param {array} list  an array of renders to perform
 * @param {string} origFile  the name of the original file being rendered
 * @param {jimp.image} image  the jimp image object to perform the renders with.
 * @param {fn} cb  node style callback 
 */
function getRenderList() {

    // our default renders
    var renderList = ImageRenders;

    // pull from config file if set:
    if (sails.config.fcfcore
        && sails.config.fcfcore.images 
        && sails.config.fcfcore.images.renders) {

        renderList = sails.config.fcfcore.images.renders;
    }


    return _.clone(renderList);
}


/**
 * Auto-orient an image file, then create additional renderings of it
 * based on the given `renders` array. Processing is handled by the external
 * ImageMagick 'convert' utility.
 *
 * @param {array} renders
 *      Array of basic objects. Each object specifies how an additional
 *      render of the image will be done. 
 *      See getRenderList() and ImageRenders above.
 *      [
 *          {
 *              name: {string},     // to be appended to the new filename
 *              quality: {integer}, // JPEG quality?
 *              width: {integer},   // max width in pixels to resize to
 *              height: {integer},  // max height in pixels to resize to
 *              default: {boolean}, // no effect in this function
 *          },
 *          ...
 *      ]
 *      Should this even be a function parameter? We could just call
 *      the getRenderList() function directly here.
 * @param {string} sourceFile
 *      Full path and filename of the source image.
 * @param {string} [targetDir]
 *      Full path of the target directory where the image files will be
 *      written to. Default is the same directory as source.
 * @return {Promise}
 */
function processImageFile(renders, sourceFile, targetDir=null) {
    return new Promise((resolve, reject) => {
        //// Parse the file path
        
        var parsed = path.parse(sourceFile);
        // path to the source file
        var sourceDir = parsed.dir;
        // filename with no directory or extension
        var baseName = parsed.name;
        // file extension
        var extension = parsed.ext;
        // path to the target file
        if (!targetDir) {
            targetDir = sourceDir;
        }
        
        //// Process image
        async.series([
            
            // Ensure image has correct orientation based on EXIF data and save
            // to target directory.
            (next) => {
                var targetFile = path.join(targetDir, baseName + extension);
                // ImageMagick
                child_process.exec(
                    `convert "${sourceFile}" -auto-orient "${targetFile}"`,
                    (err, stdout, stderr) => {
                        if (err) {
                            console.error(
                                'ImageMagick error while processing ' + targetFile,
                                { stdout, stderr, err }
                            );
                            next(err);
                        }
                        else {
                            next();
                        }
                    }
                );
            },
            
            // Create additional renders and save to target directory.
            (next) => {
                async.eachSeries(
                    renders, 
                    (renderOpts, renderDone) => {
                        // '-quality' option applicable for JPEG images
                        var qualityOpt = '';
                        if (extension.match(/jpe?g$/i) && renderOpts.quality) {
                            qualityOpt = '-quality ' + renderOpts.quality;
                        }
                        
                        // Append the name for this render
                        var targetFile = path.join(targetDir, baseName + renderOpts.name + extension);
                        
                        // ImageMagick
                        child_process.exec(
                            `convert "${sourceFile}" -auto-orient -resize ${renderOpts.width}x${renderOpts.height} ${qualityOpt} "${targetFile}"`,
                            (err, stdout, stderr) => {
                                if (err) {
                                    console.error(
                                        'ImageMagick error while processing ' + targetFile, 
                                        { renderOpts, stdout, stderr, err }
                                    );
                                    renderDone(err);
                                }
                                else {
                                    renderDone();
                                }
                            }
                        );
                    }, 
                    (err) => {
                        if (err) next(err);
                        else next();
                    }
                )
            },
            
        ], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}


/*
 * @function renderFile
 * 
 * THIS WAS USED PREVIOUSLY INSTEAD OF processImageFile()
 * 
 * recursively process a list of Render Commands on a given
 * file.
 *
 * the output of the render'ed file will match the original Filename
 * + a render.name tag at the end.
 *
 * @param {array} list  an array of renders to perform
 * @param {string} origFile  the name of the original file being rendered
 * @param {jimp.image} image  the jimp image object to perform the renders with.
 * @param {fn} cb  node style callback 
 */
function renderFile(list, origFile, cb) {
    if (list.length == 0) {
        cb();
    } else {

        var render = list.shift();
        var toFile = origFile.replace('.', render.name+'.');

        // jimp.read(origFile)
        // .then(function(image){

        //     image
        //     .quality(render.quality)
        //     .scaleToFit( render.width, render.height )
        //     .write(toFile, function(err){
        //         if (err) {
        //             cb(err);
        //         } else {
        //             renderFile(list, origFile, cb);
        //         }
        //     })

        // })
        // .catch(function(err){
        //     cb(err);
        // });


        var params = [
            path.join(__dirname, '..', '..', 'setup', 'jimpIt.js'),
            'origFile:'+origFile,
            'quality:'+render.quality,
            'width:'+render.width,
            'height:'+render.height,
            'name:'+render.name
        ]

        var startTime = process.hrtime();

        AD.spawn.command({
            command:'node',
            options:params,
            shouldEcho:false
        })
        .fail(function(err){
            cb(err);
        })
        .then(function(code){

            console.log('... rendered: '+elapsedTime(startTime)+" :"+toFile.split(path.sep).pop())
            renderFile(list, origFile, cb);
        });



    }
}





/*
 * @function elapsedTime
 *
 * return a timing string representing the #s #ms since the 
 * passed in startTime was taken.
 *
 * @param {array} startTime  timing data gathered from process.hrtime()
 * @return {string} 
 */
function elapsedTime(startTime) {
    var elapsed = process.hrtime(startTime);

    var timingString = elapsed[0]>0 ? elapsed[0]+'s' :'  ';
    timingString += (parseInt(elapsed[1]/1000000))+'ms';

    return timingString;
}


var PostApprovalRequest = function (options) {
    // options.data   : the data to approve  (image model instance)
    // 
// console.log('... PostApprovalRequest:', options);

    var action = 'fcf.activityapproval.newImage';
    if (options.action == 'updated' || options.action == 'approved' || options.action == 'ready') action = 'fcf.activityapproval.updatedImage';

    var languageCode = options.languageCode || Multilingual.languages.default();

    var creator = null;
    var image = null;
    var activity = null;
    var teamMembers = null;
    var listTeammates = null;
    var listTeammatesTagged = null;
    var listTeammatesNotTagged = null;
    var status = "pending";
    console.log("before status: " + status);
    if (options.data.status == "approved" || options.data.status == "ready") {
        status = options.data.status;
    }
    console.log("after status: " + status);

    var commonData = null;

    async.series([


        // pull full image data:
        function(next) {

            FCFActivityImages.findOne(options.data.id)
            .populate('translations')
            .populate('taggedPeople')
            .populate('uploadedBy')
            .populate('activity')
            .exec(function(err, thisImage){

                if (err) {
                    var myErr = new Error('Error looking up image');
                    myErr.error = err;
                    next(myErr);
                } else {

// console.log('... found image:', thisImage);
                    image = thisImage.toClient(languageCode);
                    next();


                }

            })
        },


        // Pull all Teammates for this person:
        function(next) {

            var peopleIDs = [];
            
            FCFMinistryTeamMember.find({IDMinistry:image.activity.team})
            .then(function(list){

                if (list) {

                    list.forEach(function(entry){
                        if (entry.IDPerson) {
                            peopleIDs.push(entry.IDPerson);
                        }
                    })
                }

                FCFPerson.find({IDPerson:peopleIDs})
                .then(function(listPeople){

                    listPeople.forEach(function(person){
                        person.display_name = person.displayName(Multilingual.languages.default());
                        person.avatar = null; // '/images/activities_person_avatar.jpeg';
                        AD.log('... found teammember:'+ person.display_name);                        
                    })
                    listTeammates = listPeople;

                    addAvatar(listTeammates, function(err) {

                        if (err) { next(err);  return; }


                        var finalList = [];
                        listTeammates.forEach(function(person){
                            // if (person.avatar != null) {
                                
// NOTE: 10 Nov 2016 : decide to add Alfred back in.
if (person.avatar == null) {
    person.avatar = path.join('images', 'fcf_activities', 'icon_person_avatar.jpeg');
}
                                finalList.push(person)
                            // } else {
                            //     AD.log('... removing member that did not have avatar: '+ person.display_name);
                            // }
                        });

                        listTeammates = finalList;

                        next();
                    });


                })
                .catch(function(err){
                    AD.log(err);
                    next(err);
                })

            })
            .catch(function(err){
                AD.log(err);
                next(err);
            })

        },

////// LEFT OFF HERE:
/// figure out where to add language_code to template data


        // sort list of ppl in image
        // and people not in image
        function(next){

            listTeammatesTagged = [];
            listTeammatesNotTagged = [];

//          var taggedIDs = _.pluck(image.taggedPeople, 'IDPerson');

// console.log('----> taggedIDs:', taggedIDs);

            listTeammates.forEach(function(person){
// console.log('........ person:', person);

                if (image.taggedPeople.indexOf(person.IDPerson) != -1) {
                    listTeammatesTagged.push(person);
                } else {
                    listTeammatesNotTagged.push(person);
                }
            })

            next();
        },


        // get the activity this image is attached to
        function(next) {
            FCFActivity.findOne({ id: options.data.activity})
            .exec(function(err, myActivity){

                if (err) {

                    next(err);
                } else {

                    activity = myActivity;

                    activity.translate()
                    .fail(function(err){
                        var myErr = new Error('Error translating activity.');
                        myErr.error = err;
                        next(myErr);
                    })
                    .then(function(){
                        next();
                    })
                }
            })
        },


        // get the common data for our FCF Approval Requests:
        function(next) {

            var creatorID = options.data.uploadedBy;
            if (_.isObject(creatorID)) {
                creatorID = creatorID.IDPerson;
            }
            
            FCFActivities.approvals.base({
                icon:       "fa-file-image-o",
                status:     status,
                action:     action,
                createdAt:  options.data.createdAt,
                creator:{
                    id:creatorID
                },
                callback:{
                        message:"fcf.activities.image",
                        reference: { id: options.data.id }
                    },
                permissionKey:'fcf.activity.images.approve'
            })
            .fail(function(err){
                next(err);
            })
            .then(function(request){

// AD.log('... common request data:', request);
                commonData = request;
                next();
            })
        },



        // finish out with our image approval data:
        function(next) {

            var thisData = {

                "menu":{
                    "instanceRef":"caption",
                },

                "form":{
                    "data":image,
                    "view":"/opstools/FCFActivities/views/FCFActivities/imageApproval.ejs",
                    "viewData":{
                        "taggedPeople":listTeammatesTagged,
                        "language_code":languageCode
                    }
                },


                "relatedInfo":{
                    "view":"/opstools/FCFActivities/views/FCFActivities/imageApprovalRelated.ejs",
                    "viewData":{
                        "teamID":activity.team,
                        "activity": activity,
                        "untaggedPeople": listTeammatesNotTagged
                    }
                },
                
                "status": status

            };

            requestData = lodash.defaultsDeep(thisData, commonData);
            next();
        }

    ],function(err, results){


        if (err) {
AD.log.error('!!!! error:', err);

        } else {
// AD.log('....  publishing Request Data:', requestData);


// 12 May 2017:  Fix for bloated image approval requests.
// reduce the data only to what is needed by the templates:
requestData = cleanData(requestData);
        

            ADCore.queue.publish('opsportal.approval.create', requestData);
        }

    })




}



function cleanData(objectData) {


    objectData = lodash.cloneDeep(objectData);

    function reduceObject(obj, fieldsToKeep) {
        for(var k in obj) {
            if (fieldsToKeep.indexOf(k) == -1) {
                delete obj[k];
            }
        }
    }


    function reduceActivity(activity) {
        
        // console.log('    ... cleaning activity:'+ activity.activity_name );
        var fieldsToKeep = [ 'activity_name', 'activity_description'];
        reduceObject(activity, fieldsToKeep);
    }



    function reducePerson(person) {
        
        // console.log('    ... cleaning person:'+ person.display_name );
        var fieldsToKeep = [ 'IDPerson', 'avatar', 'display_name' ];
        reduceObject(person, fieldsToKeep);
    }



    function reduceTeam(team) {
        
        // console.log('    ... cleaning team:'+ team.MinistryDisplayName );
        var fieldsToKeep = [ 'MinistryDisplayName' ];
        reduceObject(team, fieldsToKeep);
    }


    ////
    //// Form Data cleanup
    ////

    // clean up form.viewData
    if (objectData.form 
        && objectData.form.viewData) {


        // clean up form.viewData.taggedPeople
        if (objectData.form.viewData.taggedPeople) {
            
            objectData.form.viewData.taggedPeople.forEach(function(person){
                reducePerson(person);
            })
        }
        
    }

    ////
    //// Related Data cleanup
    ////

    if (objectData.relatedInfo
        && objectData.relatedInfo.viewData) {


        // clean up relatedInfo.viewData.untaggedPeople
        if (objectData.relatedInfo.viewData.activity) {

            reduceActivity(objectData.relatedInfo.viewData.activity);
            
        }


        // clean up relatedInfo.viewData.untaggedPeople
        if (objectData.relatedInfo.viewData.untaggedPeople) {

            objectData.relatedInfo.viewData.untaggedPeople.forEach(function(person){
                reducePerson(person);
            })
        }

        // clean up relatedInfo.viewData.user.teams
        if (objectData.relatedInfo.viewData.user
            && objectData.relatedInfo.viewData.user.teams) {

            objectData.relatedInfo.viewData.user.teams.forEach(function(team){
                reduceTeam(team);
            })
        }

    }


    objectData = lodash.cloneDeep(objectData);
    return objectData;
}
