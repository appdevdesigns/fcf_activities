
steal(
        // List your Controller's dependencies here:
        'appdev',
        'opstools/FCFActivities/models/UserTeam.js',
        'opstools/FCFActivities/models/TeamActivity.js',
// 'opstools/FCFActivities/controllers/FilteredElements.js',
        'opstools/FCFActivities/controllers/FilteredBootstrapTable.js',
//        'opstools/FCFActivities/models/Projects.js',
//        'appdev/widgets/ad_delete_ios/ad_delete_ios.js',
        // '//opstools/FCFActivities/views/AddChooseMinistry/AddChooseMinistry.ejs',
function(){

    // AddChooseMinistry Controller
    //
    // This controller is responsible for the operation of the "Choose Ministry"
    // step in adding an Activity.
    //
    // We display a list of UserTeams
    // We use a Typeahead.js widget to allow quick searching for entries
    // Once the user selects a team, they can continue to the [Next] page
    //
    // When [Next] is clicked/activated, this widget triggers a 'team.selected'
    // event to alert the Main FCFActivities Controller
    //
    // the .value() method will return the current model instance of the 
    // entry that was selected.
    //


    // Namespacing conventions:
    // AD.Control.extend('[application].[controller]', [{ static },] {instance} );
    AD.Control.extend('opstools.FCFActivities.AddChooseMinistry', {  


        CONST: {
            NEXT: 'team.selected'
        },

        init: function (element, options) {
            var self = this;
            options = AD.defaults({
//                    templateDOM: '//opstools/FCFActivities/views/AddChooseMinistry/AddChooseMinistry.ejs'
            }, options);
            this.options = options;

            // Call parent init
            this._super(element, options);


            this.selectedMinistry = null;


            // this.dataSource = this.options.dataSource; // AD.models.Projects;

            this.element.hide();

            this.initDOM();

            this.loadData();
            

        },



        initDOM: function () {
            var self = this;

//            this.element.html(can.view(this.options.templateDOM, {} ));

            ////
            //// Create our table entry Template
            ////

            var template = this.domToTemplate(this.element.find('.fcf-team-list > tbody:last'));
            can.view.ejs('FCFActivities_AddChooseMinistry', template);


            ////
            //// Attach to DOM elements
            ////


            // attach to the <table>
            this.tableMinistryTeams = this.element.find('.fcf-team-list');
            this.tableMinistryTeams.find('tbody:last').children().remove();



            // attach to the [Next] button && disable it
            this.buttons = {};
            this.buttons.next = this.element.find('#fcf-activity-add-chooseteam-next');
            this.buttons.next.attr('disabled', 'disabled');
            this.buttons.next.addClass('disabled');


            // attach the FilteredBootstrapTable Controller
            var Filter = AD.Control.get('opstools.FCFActivities.FilteredBootstrapTable');
            this.Filter = new Filter(this.element, {
                tagFilter: '.fcf-team-filter',
                tagBootstrapTable: '.fcf-team-list',
                scrollToSelect:true,

                // filterTable:true,

                rowClicked:function(data) {

                    if (data) {
                        self.selectedMinistry = data;
                        self.nextEnable();
                    }

                },
                rowDblClicked: function(data) {
                    // if they dbl-click a row,
                    // just continue on as if they clicked [next]
                    if (data) {
                        self.selectedMinistry = data;
                        self.nextEnable();
                        self.buttons.next.click();
                    }
                },
                termSelected:function(data) {

                    // if they select a term in the typeahead filter,
                    // just continue on as if they clicked [next]
                    if (data) {
                        self.selectedMinistry = data;
                        self.nextEnable();
                        self.buttons.next.click();
                    }
                },
                dataToTerm: function(data) {  
                    if (data) {
                        return data.MinistryDisplayName+', '+ data.ProjectOwner;
                    } else {
                        // console.error(' Ministry Team Row not setup properly.');
                        return '';
                    }
                }
            });

        },



        loadData:function() {
            var self = this;

            AD.comm.service.get({ url:'/fcf_activities/userteam/find' })
            .fail(function(err){
                console.error('problem looking up user\'s team :');
                console.error(err);
            })
            .then(function(res){

                var list = res.data || res;
                var data = new can.List(list);

                self.Filter.load(data);

            });


/*
            var modelUserTeam = AD.Model.get('opstools.FCFActivities.UserTeam');

            this.listTeams = null;
            this.searchTerms = [];  // 'searchable text'
            this.searchHash = {};   // term : $tr of matching row

            modelUserTeam.findAll()
            .fail(function(err) {
                console.log(err);
            })
            .then(function(list){

                self.listTeams = list;

                self.element.find('.fcf-team-list > tbody:last').append(can.view('FCFActivities_AddChooseMinistry', {teams:list}));

                // self.listTeams.forEach(function(team){
                //     var term = team.MinistryDisplayName+', '+ team.ProjectOwner;
                //     self.searchTerms.push( term );

                //     var rowFilter = 'tr[data-team-id="'+team.attr("IDMinistry")+'"]';
                //     var teamRow = self.element.find(rowFilter)[0];
                //     self.searchHash[term] = $(teamRow);
                // })


                // tell our Filter to scan the DOM and initialize
                self.Filter.refresh();

//// Search Box :  https://github.com/riklomas/quicksearch#readme
//// image based selector:  http://websemantics.github.io/Image-Select/
//// multi select: "Select3" : https://arendjr.github.io/select3/
//// 
/////  ----->>>   http://twitter.github.io/typeahead.js/examples/   



            })
*/

        },


        nextDisable: function() {
            
            this.buttons.next.attr('disabled', 'disabled');
            this.buttons.next.addClass('disabled');

        },


        nextEnable: function() {
            
            this.buttons.next.removeAttr('disabled');
            this.buttons.next.removeClass('disabled');

        },


        // selectRow:function($row) {

        //     this.tableMinistryTeams.find('.selected').removeClass('selected');

        //     if ($row) {
        //         $row.addClass('selected');

        //         // once a Row is selected, we can
        //         // enable the [Next] button
        //         this.buttons.next.removeAttr('disabled');
        //         this.buttons.next.removeClass('disabled');
        //     } else {

        //         // if nothing is selected, then disable the next button
        //         this.buttons.next.attr('disabled', 'disabled');
        //         this.buttons.next.addClass('disabled');
        //     }
        // },


        // return the model instace of the UserTeam entry selected by this page
        value: function() {

            // we were expecting a Model Obj so make this look like a model Obj:
            this.selectedMinistry.getID = function() {
                return this.IDMinistry;
            }

            return this.selectedMinistry;

        },


        // // when an entry is clicked on, mark it as selected.
        // '.fcf-team-list tbody tr click': function($el, ev) {

        //     this.selectRow($el);

        //     ev.preventDefault();
        // },


        // when the [Next] button is clicked, then trigger our event:
        '#fcf-activity-add-chooseteam-next click': function($el, ev) {
            this.element.trigger(this.CONST.NEXT);
        }


    });


});