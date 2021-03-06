﻿import definition = require("ui/animation");
import common = require("ui/animation/animation-common");
import utils = require("utils/utils");
import color = require("color");
import trace = require("trace");
import types = require("utils/types");

global.moduleMerge(common, exports);

var floatType = java.lang.Float.class.getField("TYPE").get(null);
var argbEvaluator = new android.animation.ArgbEvaluator();

export class Animation extends common.Animation implements definition.Animation {
    private _animatorListener: android.animation.Animator.AnimatorListener;
    private _nativeAnimatorsArray: any;
    private _animatorSet: android.animation.AnimatorSet; 
    private _animators: Array<android.animation.Animator>;
    private _propertyUpdateCallbacks: Array<Function>;
    private _propertyResetCallbacks: Array<Function>;

    public play(): Animation {
        super.play();

        var i: number;
        var length: number;

        this._animators = new Array<android.animation.Animator>();
        this._propertyUpdateCallbacks = new Array<Function>();
        this._propertyResetCallbacks = new Array<Function>();

        i = 0;
        length = this._propertyAnimations.length;
        for (; i < length; i++) {
            this._createAnimators(this._propertyAnimations[i]);
        }

        if (this._animators.length === 0) {
            trace.write("Nothing to animate.", trace.categories.Animation);
            this._resolveAnimationFinishedPromise();
            return this;
        }

        this._nativeAnimatorsArray = java.lang.reflect.Array.newInstance(android.animation.Animator.class, this._animators.length);
        i = 0;
        length = this._animators.length;
        for (; i < length; i++) {
            this._nativeAnimatorsArray[i] = this._animators[i];
        }

        this._animatorSet = new android.animation.AnimatorSet();
        this._animatorSet.addListener(this._animatorListener);
        if (this._playSequentially) {
            this._animatorSet.playSequentially(this._nativeAnimatorsArray);
        }
        else {
            this._animatorSet.playTogether(this._nativeAnimatorsArray);
        }

        trace.write("Starting " + this._nativeAnimatorsArray.length + " animations " + (this._playSequentially ? "sequentially." : "together."), trace.categories.Animation);
        this._animatorSet.start();
        return this;
    }

    public cancel(): void {
        super.cancel();
        trace.write("Cancelling AnimatorSet.", trace.categories.Animation);
        this._animatorSet.cancel();
    }

    constructor(animationDefinitions: Array<definition.AnimationDefinition>, playSequentially?: boolean) {
        super(animationDefinitions, playSequentially);

        var that = this;
        this._animatorListener = new android.animation.Animator.AnimatorListener({
            onAnimationStart: function (animator: android.animation.Animator): void {
                that._onAndroidAnimationStart();
            },
            onAnimationRepeat: function (animator: android.animation.Animator): void {
                that._onAndroidAnimationRepeat();
            },
            onAnimationEnd: function (animator: android.animation.Animator): void {
                that._onAndroidAnimationEnd();
            },
            onAnimationCancel: function (animator: android.animation.Animator): void {
                that._onAndroidAnimationCancel();
            }
        });
    }

    private _onAndroidAnimationStart() {
        trace.write("AndroidAnimation._onAndroidAnimationStart.", trace.categories.Animation);
    }

    private _onAndroidAnimationRepeat() {
        trace.write("AndroidAnimation._onAndroidAnimationRepeat.", trace.categories.Animation);
    }

    private _onAndroidAnimationEnd() {
        trace.write("AndroidAnimation._onAndroidAnimationEnd.", trace.categories.Animation);

        if (!this.isPlaying) {
            // It has been cancelled
            return;
        }

        var i = 0;
        var length = this._propertyUpdateCallbacks.length;
        for (; i < length; i++) {
            this._propertyUpdateCallbacks[i]();
        }
        this._resolveAnimationFinishedPromise();
    }

    private _onAndroidAnimationCancel() {
        trace.write("AndroidAnimation._onAndroidAnimationCancel.", trace.categories.Animation);
        var i = 0;
        var length = this._propertyResetCallbacks.length;
        for (; i < length; i++) {
            this._propertyResetCallbacks[i]();
        }
        this._rejectAnimationFinishedPromise();
    }

    private _createAnimators(propertyAnimation: common.PropertyAnimation): void {
        trace.write("Creating ObjectAnimator(s) for animation: " + common.Animation._getAnimationInfo(propertyAnimation) + "...", trace.categories.Animation);

        if (types.isNullOrUndefined(propertyAnimation.target)) {
            throw new Error("Animation target cannot be null or undefined!");
        }

        if (types.isNullOrUndefined(propertyAnimation.property)) {
            throw new Error("Animation property cannot be null or undefined!");
        }

        if (types.isNullOrUndefined(propertyAnimation.value)) {
            throw new Error("Animation value cannot be null or undefined!");
        }

        var nativeArray;
        var nativeView: android.view.View = (<android.view.View>propertyAnimation.target._nativeView);
        var animators = new Array<android.animation.ValueAnimator>();
        var propertyUpdateCallbacks = new Array<Function>();
        var propertyResetCallbacks = new Array<Function>();
        var animator: android.animation.ValueAnimator;
        var originalValue;
        var density = utils.layout.getDisplayDensity();
        switch (propertyAnimation.property) {

            case common.Properties.opacity:
                originalValue = nativeView.getAlpha();
                if (propertyAnimation.value !== propertyAnimation.target.opacity) {
                    nativeArray = java.lang.reflect.Array.newInstance(floatType, 1);
                    nativeArray[0] = propertyAnimation.value;
                    animators.push(android.animation.ObjectAnimator.ofFloat(nativeView, "alpha", nativeArray));
                    propertyUpdateCallbacks.push(() => { propertyAnimation.target.opacity = propertyAnimation.value });
                    propertyResetCallbacks.push(() => { nativeView.setAlpha(originalValue); });
                }
                break;

            case common.Properties.backgroundColor:
                originalValue = nativeView.getBackground();
                if (!color.Color.equals(propertyAnimation.value, propertyAnimation.target.backgroundColor)) {
                    nativeArray = java.lang.reflect.Array.newInstance(java.lang.Object.class, 2);
                    nativeArray[0] = propertyAnimation.target.backgroundColor ? java.lang.Integer.valueOf((<color.Color>propertyAnimation.target.backgroundColor).argb) : java.lang.Integer.valueOf(-1);
                    nativeArray[1] = java.lang.Integer.valueOf((<color.Color>propertyAnimation.value).argb);
                    animator = android.animation.ValueAnimator.ofObject(argbEvaluator, nativeArray);
                    animator.addUpdateListener(new android.animation.ValueAnimator.AnimatorUpdateListener({
                        onAnimationUpdate(animator: android.animation.ValueAnimator) {
                            var argb = (<java.lang.Integer>animator.getAnimatedValue()).intValue();
                            propertyAnimation.target.backgroundColor = new color.Color(argb);
                        }
                    }));

                    animators.push(animator);
                    propertyUpdateCallbacks.push(() => { propertyAnimation.target.backgroundColor = propertyAnimation.value; });
                    propertyResetCallbacks.push(() => { nativeView.setBackground(originalValue); });
                }
                break;

            case common.Properties.translate:
                originalValue = nativeView.getTranslationX();
                if (propertyAnimation.value.x * density !== originalValue) {
                    nativeArray = java.lang.reflect.Array.newInstance(floatType, 1);
                    nativeArray[0] = propertyAnimation.value.x * density;
                    animators.push(android.animation.ObjectAnimator.ofFloat(nativeView, "translationX", nativeArray));
                    propertyResetCallbacks.push(() => { nativeView.setTranslationX(originalValue); });
                }

                originalValue = nativeView.getTranslationY();
                if (propertyAnimation.value.y * density !== originalValue) {
                    nativeArray = java.lang.reflect.Array.newInstance(floatType, 1);
                    nativeArray[0] = propertyAnimation.value.y * density;
                    animators.push(android.animation.ObjectAnimator.ofFloat(nativeView, "translationY", nativeArray));
                    propertyResetCallbacks.push(() => { nativeView.setTranslationY(originalValue); });
                }
                break;

            case common.Properties.rotate:
                originalValue = nativeView.getRotation();
                if (propertyAnimation.value !== originalValue) {
                    nativeArray = java.lang.reflect.Array.newInstance(floatType, 1);
                    nativeArray[0] = propertyAnimation.value;
                    animators.push(android.animation.ObjectAnimator.ofFloat(nativeView, "rotation", nativeArray));
                    propertyResetCallbacks.push(() => { nativeView.setRotation(originalValue); });
                }
                break;

            case common.Properties.scale:
                originalValue = nativeView.getScaleX();
                if (propertyAnimation.value.x !== originalValue) {
                    nativeArray = java.lang.reflect.Array.newInstance(floatType, 1);
                    nativeArray[0] = propertyAnimation.value.x;
                    animators.push(android.animation.ObjectAnimator.ofFloat(nativeView, "scaleX", nativeArray));
                    propertyResetCallbacks.push(() => { nativeView.setScaleX(originalValue); });
                }

                originalValue = nativeView.getScaleY();
                if (propertyAnimation.value.y !== originalValue) {
                    nativeArray = java.lang.reflect.Array.newInstance(floatType, 1);
                    nativeArray[0] = propertyAnimation.value.y;
                    animators.push(android.animation.ObjectAnimator.ofFloat(nativeView, "scaleY", nativeArray));
                    propertyResetCallbacks.push(() => { nativeView.setScaleY(originalValue); });
                }
                break;

            default:
                throw new Error("Cannot animate " + propertyAnimation.property);
                break;
        }

        var i = 0;
        var length = animators.length;
        for (; i < length; i++) {
            if (propertyAnimation.duration !== undefined) {
                animators[i].setDuration(propertyAnimation.duration);
            }
            if (propertyAnimation.delay !== undefined) {
                animators[i].setStartDelay(propertyAnimation.delay);
            }
            if (propertyAnimation.iterations !== undefined) {
                if (propertyAnimation.iterations === Number.POSITIVE_INFINITY) {
                    animators[i].setRepeatCount(android.view.animation.Animation.INFINITE);
                }
                else {
                    animators[i].setRepeatCount(propertyAnimation.iterations - 1);
                }
            }
            if (propertyAnimation.curve !== undefined) {
                animators[i].setInterpolator(propertyAnimation.curve);
            }
            trace.write("ObjectAnimator created: " + animators[i], trace.categories.Animation);
        }

        this._animators = this._animators.concat(animators);
        this._propertyUpdateCallbacks = this._propertyUpdateCallbacks.concat(propertyUpdateCallbacks);
        this._propertyResetCallbacks = this._propertyResetCallbacks.concat(propertyResetCallbacks);
    }
}