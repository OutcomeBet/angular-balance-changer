var gulp = require('gulp');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var ngAnnotate = require('gulp-ng-annotate');

gulp.task('default', ['compress']);

gulp.task('compress', function() {
	return gulp.src(['src/balanceChanger.js'])
		.pipe(ngAnnotate())
		.pipe(uglify())
		.pipe(rename('balanceChanger.min.js'))
		.pipe(gulp.dest('dist'));
});
