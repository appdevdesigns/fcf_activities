//
//	rescalePhotos.js
//
//  this script will re render the FCF Activity photos into our desired output formats.
//
//  To use:
//  copy this to the server:  /fcf_activities/setup/rescalePhotos.js
//  $ cd /fcf_activities/setup
//  $ node rescalePhotos.js
//
//
//  The render can last a long time for a large number of files.
//  if you get disconnected, then add 'resume'  option to pickup 
//  where you left off.
//
//  $ node rescalePhotos.js resume



var AD = require('ad-utils');
var jimp = require('jimp');
var fs = require('fs-extra');  // fs but with copy!
var path = require('path');
var async = require('async');
var _ = require('lodash');


var renderDir = 'activities_render';
var pathImageDir = path.join(__dirname, '..', '..', '..', 'assets', 'data', 'fcf', 'images');
var pathFromDir = path.join(pathImageDir, 'activities');
var pathRenderDir 	= path.join(pathImageDir, renderDir);


// ignore these files in the directory:
var filesToIgnore = ['.DS_Store', 'placeholder_activity.jpg'];


// Renders
// Perform an image render according to each of these
// criteria:
//	.name 	: append this to the root file name
//  .width  : final width of the file
//  .height : final height of the file
// 
// To add another output format, insert another entry here:
var renders = [

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
    // 2.45" x 3.5" @ 300dpi:
    // 1050x735
    {
        name: '_print',
        quality:60,
        width: 1050,
        height: 735,
        'default':false
    }
]


// convert our Renders into an array of renderNames
// to easily check if a file is a rendered file.
var renderNames = [];
renders.forEach(function(r){
	renderNames.push(r.name);
});


/*
 * @function readFromDir
 *
 * return an array of all the files in a given directory path
 *
 * @param {string} fromDirPath  the current directory to read from
 * @param {fn} cb  node style callback function.
 */
function readFromDir(fromDirPath, cb) {
	fs.readdir(fromDirPath, function(err, files){
		if (err) { 
			cb(err); 
		} else {
// console.log('... files to process:', files);
			cb(null, files);
		}
	})
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


/*
 * @function copyFiles
 *
 * recursively copies the list of files from the pathSrc
 * directory to the pathDest directory.
 *
 * @param {array} list  array of filenames to copy
 * @param {string} pathSrc  the source directory to copy from
 * @param {string} pathDest the destination directory to copy TO
 * @param {fn} cb  node style callback when finished.
 */
function copyFiles(list, pathSrc, pathDest, cb) {

	if (list.length == 0) {
		cb();
	} else {
		var file = list.shift();
		
		if(isIgnoredFile(file)) {
			// move along
			copyFiles(list, pathSrc, pathDest, cb);

		} else {
			
			var startTime = process.hrtime();
			
			var src = path.join(pathSrc, file);
			var dst = path.join(pathDest, file);
			fs.copy(src, dst, function(err){
				if (err) {
					cb(err);
					return;
				}
				console.log('... copy file: '+elapsedTime(startTime)+' : '+file);
				copyFiles(list, pathSrc, pathDest, cb);
			})

		}
	}
}


/*
 * @function isIgnoredFile
 *
 * checks if a given filename matches one of our ignored files
 *
 * @param {string} fileName  the filename to check
 * @return {bool} 
 */
function isIgnoredFile(fileName) {

	return (filesToIgnore.indexOf(fileName) != -1);
}


/*
 * @function isRenderedFile
 *
 * checks if a given filename follows one of our renderd output name
 * formats.
 *
 * @param {string} fileName  the filename to check
 * @return {bool} 
 */
function isRenderedFile(fileName) {
	var found = false;
	renderNames.forEach(function(r){
		if (fileName.indexOf(r) != -1) {
			found = true;
		}
	})
	return found;
}


/*
 * @function removeScaledFiles
 *
 * recursively process a list of files and delete any that follow one
 * of our rendered output name formats.
 *
 * @param {array} list  an array of Filenames to check
 * @param {fn} cb  node style callback 
 */
function removeScaledFiles(list, cb) {
	if (list.length == 0) {
		cb();
	} else {

		var fileName = list.shift();
		if (isRenderedFile(fileName)) {

			// remove file
			console.log('... removing scaled file:'+ fileName);
			fs.unlink(path.join(pathRenderDir, fileName), function(err){

				if (err) {
					cb(err);
				} else {
					removeScaledFiles(list, cb);
				}
			});
		} else {

			removeScaledFiles(list, cb);
		}
	}
}


/*
 * @function generateRenderQueue
 *
 * recursively process a list of files and determine what render 
 * operations are still needed.
 *
 * add the render ops as jobs to our queue.
 *
 * @param {array} allFiles  an array of Filenames to check
 * @param {array} queue  current value of our render jobs
 * @param {fn} cb node style callback 
 *					{obj} err
 *					{array} queue array of render jobs
 */
function generateRenderQueue(allFiles, queue, cb) {

	if (_.isUndefined(cb)){
		cb = queue;
		queue = [];
	}


	if (allFiles.length == 0) {
		cb(null, queue);
	} else {

		// get filename
		var file = allFiles.shift(); 

		// skip ignored/rendered files:
		if (!isIgnoredFile(file) && !isRenderedFile(file)) {

			// convert to full path:
			file = path.join(pathRenderDir, file);

			// for each render operation
			renders.forEach(function(r) {

				// figure out the renderName
				var renderedName = file.replace('.', r.name+'.');

				// if renderName ! exists
				if (!fs.existsSync(renderedName)) {


					queue.push({
						file:file,
						render:r
					})
				}
					// add render job to queue
			})
		}

		// recurse->next()
		generateRenderQueue(allFiles, queue, cb);
	}
}


/*
 * @function renderJob
 *
 * recursively process a list of Render Jobs (provided by generateRenderQueue())
 *
 * the output of the render'ed file will match the original Filename
 * + a render.name tag at the end.
 *
 * @param {string} pID  a unique ID for this "process"
 * @param {array} queue  an array of renders to perform
 * @param {fn} cb  node style callback 
 */
function renderJob(pID, queue, cb) {
	if (queue.length == 0) {
		cb();
	} else {

		var job = queue.shift();
		var toFile = job.file.replace('.', job.render.name+'.');

		var params = [
			'jimpIt.js',
			'origFile:'+job.file,
			'quality:'+job.render.quality,
			'width:'+job.render.width,
			'height:'+job.render.height,
			'name:'+job.render.name
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

        	console.log('... '+pID+' : rendered: '+elapsedTime(startTime)+" :"+toFile.replace(pathRenderDir+path.sep, ''))
            renderJob(pID, queue, cb);
        });

	}
}




/*
 * @function renderJobsPar
 *
 * Kick off a series of parallel renderJob() tasks.
 *
 *
 * @param {integer} numPar  the number of parallel tasks
 * @param {array} queue  an array of renders to perform
 * @param {fn} cb  node style callback 
 */
function renderJobsPar(numPar, queue, cb) {

	var numDone = 0;
	for(var i=1; i<= numPar; i++) {
		renderJob(i+'', queue, function(err){
			if (err) {
				cb(err);
			} else {
				numDone++;
				if (numDone >= numPar) {
					cb();
				}
			}
		});
	}
}


////
//// Parse any command line arguments:
////
var isRestart = false;

process.argv.forEach(function(a){
	if (a.toLowerCase() == 'resume') {
		isRestart = true;
		console.log('.... resumeing render:');
	}
})



// main
async.series([

	// step 1) make the temporary render directory:
	function (next) {

		// skip if restarting:
		if (isRestart) { next(); return; }

		console.log();
		console.log('*** Ensure our render directory exists:')
		console.log('    (and is clean)');
		console.log();
		fs.remove(pathRenderDir, function(err){
			if (err) {
				next(err);
				return;
			}

			fs.ensureDir(pathRenderDir, next);
		})
		

	},


	// step 2) copy files to our temp dir:
	function(next) {

		// skip if restarting:
		if (isRestart) { next(); return; }

		console.log();
		console.log('*** Copy Original Files');
		console.log();
		readFromDir(pathFromDir, function(err, allFiles) {

			// just grab the original base files:
			var baseFiles = _.filter(allFiles, function(f) {return !isRenderedFile(f); })
			
			copyFiles(baseFiles, pathFromDir, pathRenderDir, function(err){
				next(err);
			})
			
		})
	},


	// step 4) Process Each Image File
	function(next) {


		console.log();
		console.log('*** Render remaining files:')
		console.log();
		readFromDir(pathRenderDir, function(err, allFiles) {
			if (err) {
				next(err);
				return;
			} 
			generateRenderQueue(allFiles, function(err, queue){
				renderJobsPar(5, queue, next);
			})
			
		});
		
	},


	// step 5) copy RENDERED files back to original when done:
	function(next) {
		console.log();
		console.log('*** Copy back RENDERED files:')
		console.log();
		readFromDir(pathRenderDir, function(err, allFiles) {

			var onlyRenderedFiles = _.filter(allFiles, function(n){ return !isIgnoredFile(n); }).filter(isRenderedFile);

			copyFiles(onlyRenderedFiles, pathRenderDir, pathFromDir, function(err){
				next(err);
			})
			
		})
	}
	

], function(err, res){

	if (err) {
		console.log('... ERROR: ', err);
		return;
	}
	console.log('... rescalePhotos done!');
})
