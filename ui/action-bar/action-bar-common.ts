﻿import dts = require("ui/action-bar");
import pages = require("ui/page");
import bindable = require("ui/core/bindable");
import dependencyObservable = require("ui/core/dependency-observable");
import enums = require("ui/enums");
import proxy = require("ui/core/proxy");
import view = require("ui/core/view");
import style = require("ui/styling/style");
import observable = require("ui/core/dependency-observable");

var ACTION_ITEMS = "actionItems";

export module knownCollections {
    export var actionItems = "actionItems";
}

function onTitlePropertyChanged(data: dependencyObservable.PropertyChangeData) {
    var actionBar = <ActionBar>data.object;
    actionBar._onTitlePropertyChanged();
}

export class ActionBar extends view.View implements dts.ActionBar {
    public static titleProperty = new dependencyObservable.Property("title", "ActionBar", new proxy.PropertyMetadata(undefined, dependencyObservable.PropertyMetadataSettings.None, onTitlePropertyChanged));
    
    private _actionItems: ActionItems;
    private _navigationButton: NavigationButton;
    private _page: pages.Page;
    private _titleView: view.View;

    get title(): string {
        return this._getValue(ActionBar.titleProperty);
    }
    set title(value: string) {
        this._setValue(ActionBar.titleProperty, value);
    }

    get navigationButton(): NavigationButton {
        return this._navigationButton;
    }
    set navigationButton(value: NavigationButton) {
        if (this._navigationButton !== value) {
            if (this._navigationButton) {
                this._navigationButton.actionBar = undefined;
            }

            this._navigationButton = value;

            if (this._navigationButton) {
                this._navigationButton.actionBar = this;
            }

            this.update();
        }
    }

    get actionItems(): ActionItems {
        return this._actionItems;
    }
    set actionItems(value: ActionItems) {
        throw new Error("actionItems property is read-only");
    }

    get titleView(): view.View {
        return this._titleView;
    }
    set titleView(value: view.View) {
        if (this._titleView !== value) {
            if (this._titleView) {
                this._removeView(this._titleView);
                this._titleView.style._resetValue(style.horizontalAlignmentProperty, observable.ValueSource.Inherited);
                this._titleView.style._resetValue(style.verticalAlignmentProperty, observable.ValueSource.Inherited);
            }

            this._titleView = value;

            if (this._titleView) {
                this._titleView.style._setValue(style.horizontalAlignmentProperty, enums.HorizontalAlignment.center, observable.ValueSource.Inherited);
                this._titleView.style._setValue(style.verticalAlignmentProperty, enums.VerticalAlignment.center, observable.ValueSource.Inherited);
                this._addView(this._titleView);
            }

            this.update();
        }
    }

    get page(): pages.Page {
        return this._page;
    }
    set page(value: pages.Page) {
        this._page = value;

        this.unbind("bindingContext");
        this.bind({
            sourceProperty: "bindingContext",
            targetProperty: "bindingContext"
        }, this._page);
    }

    get android(): dts.AndroidActionBarSettings {
        return undefined;
    }

    get _childrenCount(): number {
        return this.titleView ? 1 : 0;
    }

    constructor() {
        super();
        this._actionItems = new ActionItems(this);
    }

    public static onTitleChanged

    public update() {
        // 
    }

    public _onTitlePropertyChanged() {
        //
    }

    public _updateAndroid(menu: android.view.IMenu) {
        //
    }

    public _onAndroidItemSelected(itemId: number): boolean {
        return false;
    }

    public _addArrayFromBuilder(name: string, value: Array<any>) {
        if (name === ACTION_ITEMS) {
            this.actionItems.setItems(value);
        }
    }

    public _addChildFromBuilder(name: string, value: any) {
        if (value instanceof NavigationButton) {
            this.navigationButton = value;
        }

        if (value instanceof view.View) {
            this.titleView = value;
        }
    }

    public _onBindingContextChanged(oldValue: any, newValue: any) {
        super._onBindingContextChanged(oldValue, newValue);
        if (this._navigationButton) {
            this._navigationButton.bindingContext = newValue;
        }

        this._actionItems.getItems().forEach((item, i, arr) => { item.bindingContext = newValue; });
    }

    public _eachChildView(callback: (child: view.View) => boolean) {
        if (this.titleView) {
            callback(this.titleView);
        }
    }

    public _shouldShow(): boolean {
        if (this.title ||
            (this.android && this.android.icon) ||
            this.navigationButton ||
            this.actionItems.getItems().length > 0) {

            return true;
        }

        return false;
    }
}

export class ActionItems implements dts.ActionItems {
    private _items: Array<dts.ActionItem> = new Array<dts.ActionItem>();
    private _actionBar: ActionBar;

    constructor(actionBar: ActionBar) {
        this._actionBar = actionBar;
    }

    public addItem(item: dts.ActionItem): void {
        if (!item) {
            throw new Error("Cannot add empty item");
        }

        this._items.push(item);
        item.actionBar = this._actionBar;
        this.invalidate();
    }

    public removeItem(item: dts.ActionItem): void {
        if (!item) {
            throw new Error("Cannot remove empty item");
        }

        var itemIndex = this._items.indexOf(item);
        if (itemIndex < 0) {
            throw new Error("Cannot find item to remove");
        }

        this._items.splice(itemIndex, 1);
        item.actionBar = undefined;
        this.invalidate();
    }

    public getItems(): Array<dts.ActionItem> {
        return this._items.slice();
    }

    public getItemAt(index: number): dts.ActionItem {
        if (index < 0 || index >= this._items.length) {
            return undefined;
        }

        return this._items[index];
    }

    public setItems(items: Array<dts.ActionItem>) {
        // Remove all existing items
        while (this._items.length > 0) {
            this.removeItem(this._items[this._items.length - 1]);
        }

        // Add new items
        for (var i = 0; i < items.length; i++) {
            this.addItem(items[i]);
        }

        this.invalidate();
    }

    private invalidate() {
        if (this._actionBar) {
            this._actionBar.update();
        }
    }
}

export class ActionItemBase extends bindable.Bindable implements dts.ActionItemBase {
    public static tapEvent = "tap";

    public static textProperty = new dependencyObservable.Property(
        "text", "ActionItemBase", new dependencyObservable.PropertyMetadata("", null, ActionItemBase.onItemChanged));

    public static iconProperty = new dependencyObservable.Property(
        "icon", "ActionItemBase", new dependencyObservable.PropertyMetadata(null, null, ActionItemBase.onItemChanged));

    private static onItemChanged(data: dependencyObservable.PropertyChangeData) {
        var menuItem = <ActionItemBase>data.object;
        if (menuItem.actionBar) {
            menuItem.actionBar.update();
        }
    }

    get text(): string {
        return this._getValue(ActionItemBase.textProperty);
    }
    set text(value: string) {
        this._setValue(ActionItemBase.textProperty, value);
    }

    get icon(): string {
        return this._getValue(ActionItemBase.iconProperty);
    }
    set icon(value: string) {
        this._setValue(ActionItemBase.iconProperty, value);
    }

    private _actionBar: ActionBar;
    get actionBar(): ActionBar {
        return this._actionBar;
    }
    set actionBar(value: ActionBar) {
        if (value !== this._actionBar) {
            this._actionBar = value;
            if (this._actionBar) {
                this.bindingContext = this._actionBar.bindingContext;
            }
        }
    }

    public _raiseTap() {
        this._emit(ActionItemBase.tapEvent);
    }
}

export class NavigationButton extends ActionItemBase {

}
