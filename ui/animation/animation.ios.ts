﻿import definition = require("ui/animation");
import common = require("ui/animation/animation-common");
import trace = require("trace");

global.moduleMerge(common, exports);

var _transform = "_transform";
var _skip = "_skip";

var FLT_MAX = 340282346638528859811704183484516925440.000000;

class AnimationDelegateImpl extends NSObject {
    static new(): AnimationDelegateImpl {
        return <AnimationDelegateImpl>super.new();
    }

    private _finishedCallback: Function;

    public initWithFinishedCallback(finishedCallback: Function): AnimationDelegateImpl {
        this._finishedCallback = finishedCallback;
        return this;
    }

    public animationWillStart(animationID: string, context: any): void {
        trace.write("AnimationDelegateImpl.animationWillStart, animationID: " + animationID, trace.categories.Animation);
    }

    public animationDidStop(animationID: string, finished: boolean, context: any): void {
        trace.write("AnimationDelegateImpl.animationDidStop, animationID: " + animationID + ", finished: " + finished, trace.categories.Animation);
        if (this._finishedCallback) {
            var cancelled = !finished;
            // This could either be the master finishedCallback or an nextAnimationCallback depending on the playSequentially argument values.
            this._finishedCallback(cancelled);
        }
    }

    public static ObjCExposedMethods = {
        "animationWillStart": { returns: interop.types.void, params: [NSString, NSObject] },
        "animationDidStop": { returns: interop.types.void, params: [NSString, NSNumber, NSObject] }
    };
}

export class Animation extends common.Animation implements definition.Animation {
    private _iOSAnimationFunction: Function;
    private _finishedAnimations: number;
    private _cancelledAnimations: number;
    private _mergedPropertyAnimations: Array<common.PropertyAnimation>;

    public play(): Animation {
        super.play();

        this._finishedAnimations = 0;
        this._cancelledAnimations = 0;
        this._iOSAnimationFunction();

        return this;
    }

    public cancel(): void {
        super.cancel();

        var i = 0;
        var length = this._mergedPropertyAnimations.length;
        for (; i < length; i++) {
            (<UIView>this._mergedPropertyAnimations[i].target._nativeView).layer.removeAllAnimations();
            if ((<any>this._mergedPropertyAnimations[i])._propertyResetCallback) {
                (<any>this._mergedPropertyAnimations[i])._propertyResetCallback();
            }
        }
    }

    constructor(animationDefinitions: Array<definition.AnimationDefinition>, playSequentially?: boolean) {
        super(animationDefinitions, playSequentially);

        trace.write("Non-merged Property Animations: " + this._propertyAnimations.length, trace.categories.Animation);
        this._mergedPropertyAnimations = Animation._mergeAffineTransformAnimations(this._propertyAnimations);
        trace.write("Merged Property Animations: " + this._mergedPropertyAnimations.length, trace.categories.Animation);

        var that = this;
        var animationFinishedCallback = (cancelled: boolean) => {
            if (that._playSequentially) {
                // This function will be called by the last animation when done or by another animation if the user cancels them halfway through.
                if (cancelled) {
                    that._rejectAnimationFinishedPromise();
                }
                else {
                    that._resolveAnimationFinishedPromise();
                }
            }
            else {
                // This callback will be called by each INDIVIDUAL animation when it finishes or is cancelled.
                if (cancelled) {
                    that._cancelledAnimations++;
                }
                else {
                    that._finishedAnimations++;
                }

                if (that._cancelledAnimations === that._mergedPropertyAnimations.length) {
                    trace.write(that._cancelledAnimations + " animations cancelled.", trace.categories.Animation);
                    that._rejectAnimationFinishedPromise();
                }
                else if (that._finishedAnimations === that._mergedPropertyAnimations.length) {
                    trace.write(that._finishedAnimations + " animations finished.", trace.categories.Animation);
                    that._resolveAnimationFinishedPromise();
                }
            }
        };

        this._iOSAnimationFunction = Animation._createiOSAnimationFunction(this._mergedPropertyAnimations, 0, this._playSequentially, animationFinishedCallback);
    }

    private static _createiOSAnimationFunction(propertyAnimations: Array<common.PropertyAnimation>, index: number, playSequentially: boolean, finishedCallback: (cancelled?: boolean) => void): Function {
        return (cancelled?: boolean) => {
            if (cancelled && finishedCallback) {
                trace.write("Animation " + (index - 1).toString() + " was cancelled. Will skip the rest of animations and call finishedCallback(true).", trace.categories.Animation);
                finishedCallback(cancelled);
                return;
            }

            var animation = propertyAnimations[index];
            var nativeView = (<UIView>animation.target._nativeView);

            var nextAnimationCallback: Function;
            var animationDelegate: AnimationDelegateImpl;
            if (index === propertyAnimations.length - 1) {
                // This is the last animation, so tell it to call the master finishedCallback when done.
                animationDelegate = AnimationDelegateImpl.new().initWithFinishedCallback(finishedCallback);
            }
            else {
                nextAnimationCallback = Animation._createiOSAnimationFunction(propertyAnimations, index + 1, playSequentially, finishedCallback);
                // If animations are to be played sequentially, tell it to start the next animation when done. 
                // If played together, all individual animations will call the master finishedCallback, which increments a counter every time it is called.
                animationDelegate = AnimationDelegateImpl.new().initWithFinishedCallback(playSequentially ? nextAnimationCallback : finishedCallback);
            }

            trace.write("UIView.beginAnimationsContext(" + index + "): " + common.Animation._getAnimationInfo(animation), trace.categories.Animation);
            UIView.beginAnimationsContext(index.toString(), null);

            if (animationDelegate) {
                UIView.setAnimationDelegate(animationDelegate);
                UIView.setAnimationWillStartSelector("animationWillStart");
                UIView.setAnimationDidStopSelector("animationDidStop");
            }

            if (animation.duration !== undefined) {
                UIView.setAnimationDuration(animation.duration / 1000.0);
            }
            else {
                UIView.setAnimationDuration(0.3); //Default duration.
            }
            if (animation.delay !== undefined) {
                UIView.setAnimationDelay(animation.delay / 1000.0);
            }
            if (animation.iterations !== undefined) {
                if (animation.iterations === Number.POSITIVE_INFINITY) {
                    UIView.setAnimationRepeatCount(FLT_MAX);
                }
                else {
                    UIView.setAnimationRepeatCount(animation.iterations - 1);
                }
            }
            if (animation.curve !== undefined) {
                UIView.setAnimationCurve(animation.curve);
            }

            var originalValue;
            switch (animation.property) {
                case common.Properties.opacity:
                    originalValue = animation.target.opacity;
                    (<any>animation)._propertyResetCallback = () => { animation.target.opacity = originalValue };
                    animation.target.opacity = animation.value;
                    break;
                case common.Properties.backgroundColor:
                    originalValue = animation.target.backgroundColor;
                    (<any>animation)._propertyResetCallback = () => { animation.target.backgroundColor = originalValue };
                    animation.target.backgroundColor = animation.value;
                    break;
                case _transform:
                    originalValue = nativeView.transform;
                    (<any>animation)._propertyResetCallback = () => { nativeView.transform = originalValue };
                    nativeView.transform = animation.value;
                    break;
                default:
                    throw new Error("Cannot animate " + animation.property);
                    break;
            }

            trace.write("UIView.commitAnimations " + index, trace.categories.Animation);
            UIView.commitAnimations();

            if (!playSequentially && nextAnimationCallback) {
                nextAnimationCallback();
            }
        }
    }

    private static _isAffineTransform(property: string): boolean {
        return property === _transform
            || property === common.Properties.translate
            || property === common.Properties.rotate
            || property === common.Properties.scale;
    }

    private static _canBeMerged(animation1: common.PropertyAnimation, animation2: common.PropertyAnimation) {
        var result =
            Animation._isAffineTransform(animation1.property) &&
            Animation._isAffineTransform(animation2.property) &&
            animation1.target === animation2.target &&
            animation1.duration === animation2.duration &&
            animation1.delay === animation2.delay &&
            animation1.iterations === animation2.iterations &&
            animation1.curve === animation2.curve;
        return result;
    }

    private static _affineTransform(matrix: CGAffineTransform, property: string, value: any): CGAffineTransform {
        switch (property) {
            case common.Properties.translate:
                return CGAffineTransformTranslate(matrix, value.x, value.y);
            case common.Properties.rotate:
                return CGAffineTransformRotate(matrix, value * Math.PI / 180);
            case common.Properties.scale:
                return CGAffineTransformScale(matrix, value.x, value.y);
            default:
                throw new Error("Cannot create transform for" + property);
                break;
        }
    }

    private static _mergeAffineTransformAnimations(propertyAnimations: Array<common.PropertyAnimation>): Array<common.PropertyAnimation> {
        var result = new Array<common.PropertyAnimation>();

        var i = 0;
        var j;
        var length = propertyAnimations.length;
        for (; i < length; i++) {
            if (propertyAnimations[i].property !== _skip) {

                if (!Animation._isAffineTransform(propertyAnimations[i].property)) {
                    // This is not an affine transform animation, so there is nothing to merge.
                    result.push(propertyAnimations[i]);
                }
                else {

                    // This animation has not been merged anywhere. Create a new transform animation.
                    var newTransformAnimation: common.PropertyAnimation = {
                        target: propertyAnimations[i].target,
                        property: _transform,
                        value: Animation._affineTransform(CGAffineTransformIdentity, propertyAnimations[i].property, propertyAnimations[i].value),
                        duration: propertyAnimations[i].duration,
                        delay: propertyAnimations[i].delay,
                        iterations: propertyAnimations[i].iterations,
                        iosUIViewAnimationCurve: propertyAnimations[i].curve
                    };
                    trace.write("Created new transform animation: " + common.Animation._getAnimationInfo(newTransformAnimation), trace.categories.Animation);

                    j = i + 1;
                    if (j < length) {
                        // Merge all compatible affine transform animations to the right into this new animation.
                        for (; j < length; j++) {
                            if (Animation._canBeMerged(propertyAnimations[i], propertyAnimations[j])) {
                                trace.write("Merging animations: " + common.Animation._getAnimationInfo(newTransformAnimation) + " + " + common.Animation._getAnimationInfo(propertyAnimations[j]) + " = ", trace.categories.Animation);
                                trace.write("New native transform is: " + NSStringFromCGAffineTransform(newTransformAnimation.value), trace.categories.Animation);
                                newTransformAnimation.value = Animation._affineTransform(newTransformAnimation.value, propertyAnimations[j].property, propertyAnimations[j].value);
                            
                                // Mark that it has been merged so we can skip it on our outer loop.
                                propertyAnimations[j].property = _skip;
                            }
                        }
                    }

                    result.push(newTransformAnimation);
                }
            }
        }

        return result;
    }
}