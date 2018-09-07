// Dependencies
steal(
    "opstools/FCFActivities/models/Ministry_name:string.js"
)

// Initialization
.then(function(){


    //Define the unit tests
    describe('testing model AD.models.opstools.FCFActivities.Ministry_name:string ', function(){


        before(function(){


        });


        it('model definition exists ', function(){
            assert.isDefined(AD.models.opstools , ' :=> should have been defined ');
            assert.isDefined(AD.models.opstools.FCFActivities , ' :=> should have been defined ');
            assert.isDefined(AD.models.opstools.FCFActivities.Ministry_name:string, ' :=> should have been defined ');
               assert.isNotNull(AD.Model.get("opstools.FCFActivities.Ministry_name:string"), ' :=> did not return null');
        });

    });


});