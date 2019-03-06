/**
 * Routes
 *
 * Use this file to add any module specific routes to the main Sails
 * route object.
 */


module.exports = {


  /*

  '/': {
    view: 'user/signup'
  },
  '/': 'fcf_activities/PluginController.inbox',
  '/': {
    controller: 'fcf_activities/PluginController',
    action: 'inbox'
  },
  'post /signup': 'fcf_activities/PluginController.signup',
  'get /*(^.*)' : 'fcf_activities/PluginController.profile'

  */
  
  // 'get /fcfactivities/userteam/find':'fcf_activities/UserTeamController.find'
  'get /fcfactivities/teamactivities':'fcf_activities/TeamActivityController.find',
  'post /fcfactivities/teamactivities':'fcf_activities/TeamActivityController.create',

  'get /fcf_activities/teamobjectives':'fcf_activities/TeamObjectiveController.find',
  'get /fcfactivities/activityreport/activities':'fcf_activities/ActivityReportController.activities',
  'get /fcf_activities/activityreport/approve/:id':'fcf_activities/ActivityReportController.approveActivity',

  // Access to Activity Image Resource 
  'get /fcf_activities/activityimage':'fcf_activities/ActivityImageController.find',
  'get /fcf_activities/activityimage/:id':'fcf_activities/ActivityImageController.findOne',
  'get /fcf_activities/originalactivityimage/:id':'fcf_activities/ActivityImageController.findOrig',
  'get /fcf_activities/activityimagecount':'fcf_activities/ActivityImageController.getCount',
  'post /fcf_activities/activityimage':'fcf_activities/ActivityImageController.create',
  'put /fcf_activities/activityimage/:id':'fcf_activities/ActivityImageController.update',
  'delete /fcf_activities/activityimage/:id':'fcf_activities/ActivityImageController.destroy',

  'post /fcf_activities/activityimageupload':'fcf_activities/ActivityImageController.upload',

  'get /fcf_activities/teammembers':'fcf_activities/ActivityReportController.teammembers',
  'get /fcf_activities/getdenial':'fcf_activities/ActivityImageController.getDenial',
  'get /fcf_activities/getactivityaddstatus':'fcf_activities/ActivityImageController.getActivityAddStatus',


  ////
  //// Mobile API additions
  ////
  //// get /fcf_activities/mobile/myactivityimages : return the users activity images
  //// get /fcf_activities/mobile/myteams : return the user's team information
  ////
  'get /fcf_activities/mobile/myactivityimages':'fcf_activities/ActivityImageController.mobileMyImages',
  'get /fcf_activities/mobile/myteams':'fcf_activities/ActivityImageController.mobileMyTeams',
  'get /fcf_activities/mobile/myprojects':'fcf_activities/ActivityImageController.mobileMyProjects'



};

