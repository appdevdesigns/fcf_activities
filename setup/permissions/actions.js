/**
 * This file specifies any system Action permission keys that are used by the 
 * apps in this Module.
 *
 * Action Keys are assigned to a user in the system by the Roles & Permission 
 * system.  An Action Key is a unique string usually specified in the following
 * format:  "[application].[subapp].[verb]"  which represents permission to 
 * perform [verb]  for the [subapp] portion of the [application].
 *
 * [verbs] can be anything, but CRUD terms are preferred [ create, read, update, destroy]
 *
 * eg
 *  "adcore.permissions.admin"  : does the user have permission to administrate 
 *                                permissions on the system?
 *
 *  or perhaps you want more fine grain control:

 *  "adcore.permissions.user.create" : can user add permissions to a user?
 *  "adcore.permissions.user.destroy" : can user remove permissions from a user
 *  "adcore.permissions.roles.create" : can a user create roles in the system
 *  "adcore.permissions.roles.destroy" : can user remove a role?
 *  ...
 *
 *  
 */
module.exports = {

    language_code:'en',

    actions:[
        { 
            action_key:'fcf.activities', 
            action_description:'Allows the user to submit activity photos.' 
        },
        {
        	action_key:'fcf.activities.approve',
        	action_description:'Allows the user to approve an activity.'
        },
        {
        	action_key:'fcf.activity.images.approve',
        	action_description:'Allows the user to approve an image submitted to an activity.'
        },
        { 
            action_key:'adroit.activity.upload', 
            action_description:'Allow the user to upload an activity.' 
        }
    ]

};
