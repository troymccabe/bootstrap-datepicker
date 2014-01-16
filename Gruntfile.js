module.exports = function (grunt) {
    "use strict";

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            dist: ['dist']
        },
        copy: {
            js: {
                src: ['js/datepicker.js'],
                dest: 'dist/'
            }
        },
        jshint: {
            options: {
                jshintrc: 'js/.jshintrc'
            },
            gruntfile: {
                src: 'Gruntfile.js'
            },
            src: {
                src: ['js/*.js']
            },
            test: {
                src: ['js/unit/**/*.js', 'js/unit/**/**/*.js']
            }
        },
//        qunit: {
//            files: ['tests/js/*.html', 'tests/js/**/*.html']
//        },
        recess: {
            options: {
                compile: true
            },
            datepicker: {
                src: ['less/datepicker/build.less'],
                dest: 'dist/css/datepicker.css'
            },
            datepicker_min: {
                options: {
                    compress: true
                },
                src: ['less/datepicker/build.less'],
                dest: 'dist/css/datepicker.min.css'
            }
        },
        uglify: {
            core: {
                src: ['js/datepicker.js'],
                dest: 'dist/js/datepicker.min.js'
            }
        },
        watch: {
            src: {
                files: ['js/*.js'],
                tasks: ['dist-js']
            },
            recess: {
                files: ['less/*.less'],
                tasks: ['dist-css']
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-recess');

    grunt.registerTask('test', ['jshint', 'qunit']);
    grunt.registerTask('dist-js', ['uglify', 'copy']);
    grunt.registerTask('dist-css', ['recess']);
    grunt.registerTask('dist', ['clean', 'dist-css', 'dist-js', 'copy']);
    grunt.registerTask('default', ['test', 'dist']);
};