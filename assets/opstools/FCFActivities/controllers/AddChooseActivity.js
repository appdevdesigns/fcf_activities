
steal(
// List your Controller's dependencies here:
	'opstools/FCFActivities/models/TeamActivity.js',
	'opstools/FCFActivities/models/TeamObjective.js',
	// '//opstools/FCFActivities/views/AddChooseActivity/AddChooseActivity.ejs',
	function () {
        System.import('appdev').then(function () {
			steal.import(
				'appdev/ad',
				'appdev/control/control',
				'OpsPortal/controllers/FilteredBootstrapTable'
				).then(function () {
				
					// Namespacing conventions:
					// AD.Control.extend('[application].[controller]', [{ static },] {instance} );
					AD.Control.extend('opstools.FCFActivities.AddChooseActivity', {


						CONST: {
							NEXT: 'activity.selected',
							PREV: 'activity.previous'
						},

						init: function (element, options) {
							var self = this;
							options = AD.defaults({
								//                    templateDOM: '//opstools/FCFActivities/views/AddChooseActivity/AddChooseActivity.ejs'
							}, options);
							this.options = options;

							// Call parent init
							this._super(element, options);


							this.selectedTeam = null; // which team are we displaying results for?
							this.listActivities = null; // track all the activities we've loaded.  
							this.selectedActivity = null; // which activity was selected.
							this.listActivitiesFull = null; // we will store all activites here so we can filter and reveal later

							this.element.hide();

							this.initDOM();

            
							// listen for any FCF Assignment updates  and refresh our list  
							AD.comm.socket.subscribe('fcf_activity_new_external', function (key, data) {

								if (self.selectedTeam) {
									if (self.selectedTeam.getID() == data.team) {

										// this matches the list of activities we are currently viewing
										var Model = AD.Model.get('opstools.FCFActivities.TeamActivity');
										var newActivity = new Model(data.activity);

										self.listActivities.push(newActivity);
									}
								}
							})



						},



						/**
						 *  @function initDom
						 *
						 *  This method attaches this controller to the relevant DOM objects, 
						 *  and creates any templates it needs.
						 *
						 *  This method clears off any unnecessary DOM objects from the 
						 *  template, but does not update the display with any live data.
						 *  (see loadData() for that)
						 */
						initDOM: function () {
							var self = this;


							////
							//// Create our Objective entry Template
							////

							var objectivesTemplate = this.domToTemplate(this.element.find('.objectives-section'));
							can.view.ejs('FCFActivities_AddObjectives', objectivesTemplate);
							this.element.find('.objectives-section').html('');  // clear the contents!



							////
							//// Attach to DOM elements
							////

							// Ministry Title:
							this.titleMinistry = this.element.find('.fcf-activity-add-chooseActivity-teamName');


							// attach to the <table>
							this.tableTeamActivities = this.element.find('.fcf-activity-list');
							this.tableTeamActivities.find('tbody > tr').remove();


							// attach to the [Next] button && disable it
							this.buttons = {};
							this.buttons.next = this.element.find('#fcf-activity-add-chooseAssignment-next');
							this.buttons.next.attr('disabled', 'disabled');
							this.buttons.next.addClass('disabled');


							// attach the FilteredBootstrapTable Controller
							var Filter = AD.Control.get('OpsPortal.FilteredBootstrapTable');
							this.Filter = new Filter(this.element, {
								tagFilter: '.fcf-activity-filter',
								tagBootstrapTable: '.fcf-activity-list',
								scrollToSelect: true,

								cssSelected: 'selectedRow',

								// filterTable:true,

								rowClicked: function (data) {

									if (data) {
										self.selectedActivity = data;
										self.nextEnable();
									}

								},
								rowDblClicked: function (data) {
									// if they dbl-click a row,
									// just continue on as if they clicked [next]
									if (data) {
										self.selectedActivity = data;
										self.nextEnable();
										self.buttons.next.click();
									}
								},
								termSelected: function (data) {

									// if they select a term in the typeahead filter,
									// just continue on as if they clicked [next]
									if (data) {
										self.selectedActivity = data;

										self.nextEnable();
										self.buttons.next.click();
									}
								},
								dataToTerm: function (data) {
									if (data) {
										if (self.showCurrent()) {
											var now = new Date();
											var endDate = new Date(data.date_end);
											if (data.date_end == "" || data.date_end == null || endDate.getTime() > now.getTime()) {
												return data.activity_name;
											}
										} else {
											return data.activity_name;
										}
									} else {
										// console.error(' Ministry Team Row not setup properly.');
										return '';
									}
								}
							});


							//// Add Activity Modal:
							this.modalAdd = this.element.find("#fcf-modal-new-Activity");


							//// Create a Form for our Add Activity
							this.form = new AD.op.Form(this.modalAdd.find('#fcf-new-activity-form'));
							this.form.bind(AD.Model.get('opstools.FCFActivities.TeamActivity'));
							this.form.addField('objective', 'array', { notEmpty: {} });
							this.form.addValidation('date_end', {
								dateGreaterThan: {
									value: "date_start",
									format: "mm/dd/yyyy",
									canEqual: true
								}
							});
							this.form.attach();

						},



						/**
						 * @function formClear
						 * 
						 * clears the input fields on the Add Assigment Modal.
						 *
						 */
						formClear: function () {
							this.form.clear();
						},



						formErrors: function (values) {

							return this.form.errors();

						},



						formValid: function (values) {

							return this.form.isValid();

						},



						formValues: function () {

							var obj = this.form.values();

							// make sure .objective is an []
							if (obj.objective) {
								if (!$.isArray(obj.objective)) obj.objective = [obj.objective];
							}

							// manually set our team value
							obj.team = this.selectedTeam.getID();

							return obj;
						},



						loadData: function (team) {
							var self = this;

							this.selectedTeam = team;

							// expect that a loadData with a new team should reset our 
							// selected activity
							this.selectedActivity = null;
							this.nextDisable(); 

							// update our Team Title:
							this.titleMinistry.text(team.attr('MinistryDisplayName'));

							this.Filter.busy();

							var modelTeamActivity = AD.Model.get('opstools.FCFActivities.TeamActivity');
							modelTeamActivity.findAll({ team: team.getID() })
								.fail(function (err) {
									self.Filter.ready();
									console.log(err);
								})
								.then(function (list) {

									self.listActivitiesFull = list;
									self.setUpTable();
									
								});


							// update the objectives for this team:
							var modelTeamObjective = AD.Model.get('opstools.FCFActivities.TeamObjective');
							modelTeamObjective.findAll({ team: team.getID() })
								.fail(function (err) {
									console.log(err);
								})
								.then(function (list) {


									// tell our form to remove the current objective entries:
									self.form.elRemove(self.modalAdd.find('.objectives-section [name="objective"]'))

									// remove the current entries from the DOM
									self.modalAdd.find('.objectives-section div').remove();

									// add the new ones
									self.modalAdd.find('.objectives-section').append(can.view('FCFActivities_AddObjectives', { objectives: list }));
            
									// tell our form about the new objective entries:
									self.form.elAdd(self.modalAdd.find('.objectives-section [name="objective"]'));

								})


						},



						nextDisable: function () {

							this.buttons.next.attr('disabled', 'disabled');
							this.buttons.next.addClass('disabled');

						},



						nextEnable: function () {

							this.buttons.next.removeAttr('disabled');
							this.buttons.next.removeClass('disabled');

						},



						postApproval: function (data) {

							AD.comm.service.get({ url: '/fcf_activities/activityreport/approve/' + data.id })
								.fail(function (err) {
									console.error('... activity approval failed:');
									console.error(err);
								})
								.then(function () {
									console.log('... activity approval sent!');
								})

						},



						resize: function (height) {

							// items needing resizing:
							// #wrap:  
							//      has bottom padding -20

							// #content: 
							//      #wrap: -20
							//      inner padding: -10, -10
							//      pagenation: -25
							//      navbuttons: -35
							//      bottom margin: -20


							// height is our avialable height according to our FCFActivity controller
							this.element.find('[resize-adj]').each(function (indx, el) {

								var $el = $(el);
								var adj = parseInt($el.attr('resize-adj'), 10);

								$el.css('height', (height + adj) + 'px');
							})
						},


						setUpTable: function() {
							var self = this;
							
							var list = self.listActivitiesFull;
							
							if (self.showCurrent()) {
								list = list.filter(function(value, index, array) {
									var now = new Date();
									var endDate = new Date(value.date_end);
									if (value.date_end == "" || value.date_end == null || endDate.getTime() > now.getTime()) {
										return true;
									}
								})
							}

							console.log(list);

							self.listActivities = list;

							// tell our Filter to load these Activities
							self.Filter.load(list);
							self.Filter.ready();

						},


						show: function () {

							// Call parent show()
							this._super();

							// make sure we resetView() on bootstraptable
							this.Filter.resetView();
						},
						
						
						
						showCurrent: function() {
							this.showCurrentCheckbox = this.element.find("#showCurrent");
							if (this.showCurrentCheckbox[0]) {
								return this.showCurrentCheckbox[0].checked;
							} else {
								return true;
							}
						},



						// selectRow:function($row) {

						//     this.tableTeamActivities.find('.selected').removeClass('selected');

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



						// return the value (IDMinistry) of the team selected by this page
						value: function () {

							return this.selectedActivity;
						},



						// // when an entry is clicked on, mark it as selected.
						// '.fcf-activity-list tbody tr click': function($el, ev) {

						//     this.selectRow($el);

						//     ev.preventDefault();
						// },



						// when the [Next] button is clicked, then trigger our event:
						'#fcf-activity-add-chooseAssignment-next click': function ($el, ev) {
							this.element.trigger(this.CONST.NEXT);
							ev.preventDefault();
						},



						// when the [Previous] button is clicked, then trigger our event:
						'#fcf-activity-add-chooseAssignment-previous click': function ($el, ev) {
							this.element.trigger(this.CONST.PREV);
							ev.preventDefault();
						},



						// '[name="name"] input':function($el, ev) {

						//     if ($el.val() == '') {
						//         $el.parent().removeClass('has-success').addClass('has-error');
						//     } else {
						//         $el.parent().removeClass('has-error').addClass('has-success');
						//     }
						// },



						// '[name="description"] input':function($el, ev) {

						//     if ($el.val() == '') {
						//         $el.parent().removeClass('has-success').addClass('has-error');
						//     } else {
						//         $el.parent().removeClass('has-error').addClass('has-success');
						//     }
						// },



						// when the [Add Assignment] button is clicked, 
						'#add-assignment click': function ($el, ev) {
							var self = this;
            

							// console.log('form values : ', obj);
							var obj = this.formValues();

							if (this.formValid(obj)) {
								// obj.date_start = undefined;
								var Model = AD.Model.get('opstools.FCFActivities.TeamActivity');

								Model.create(obj)
									.fail(function (err) {

										// if ! a form related error
										if (!self.form.errorHandle(err)) {

											// dump it to the console
											console.error(err); 
											// AD.op.
										}

									})
									.then(function (data) {
										data = data.data || data;

										console.log('returned Activity:', data);

										self.postApproval(data);

										var model = new Model(data);

										// issue #47: most recent first
										self.listActivities.unshift(model);

										self.Filter.selectRow(model);              // set which data row should be selected
										self.Filter.load(self.listActivities);  // load the new set of data

										self.formClear();
										self.modalAdd.modal('hide');
										self.selectedActivity = model;
										self.nextEnable();
									})

								// } else {

								// var errors = this.formErrors(obj);

								// if (errors.length>0) {

								//     bootbox.dialog({
								//         message: 'Please fix these errors before trying again:<br>'+errors.join('<br>'),
								//         title: 'Invalid Form Data',
								//         buttons: {
								//             main: {
								//                 label: 'OK',
								//                 className: "btn-primary",
								//                 callback: function() {}
								//             }
								//         }
								//     });

								// }

							}
							ev.preventDefault();

						},



						'#cancel-add-assignment click': function ($el, ev) {
							this.formClear();
							this.modalAdd.modal('hide');
							ev.preventDefault();
						},
						
						"#showCurrent click": function ($el, ev) {
							this.setUpTable();
						}


					});
				});
		});

	});