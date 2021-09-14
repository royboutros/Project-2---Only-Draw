import { Injectable } from '@angular/core';
import { BucketCommand } from '@app/classes/commands/bucket-command';
import {
    COLOR_DATA_SIZE,
    DEFAULT_TOLERANCE,
    HUNDRED_PERCENT,
    MAX_COLOR_DISTANCE,
    MAX_RGB,
    MAX_TOLERANCE,
    MIN_TOLERANCE,
} from '@app/classes/constants';
import { BucketState } from '@app/classes/state/bucket-state';
import { Tool } from '@app/classes/tool';
import { Vec2 } from '@app/classes/vec2';
import { ColorData } from '@app/enums/color-data';
import { MouseButton } from '@app/enums/mouse-buttons';
import { ToolKeys } from '@app/enums/tools-keys';
import { ToolNames } from '@app/enums/tools-names';
import { Dimensions } from '@app/interfaces/dimensions';
import { DrawingService } from '@app/services/drawing/drawing.service';

@Injectable({
    providedIn: 'root',
})
export class BucketService extends Tool {
    private oldImageData: ImageData;
    imageDataToPut: ImageData;
    private clickedColor: Uint8ClampedArray;
    private newColor: Uint8ClampedArray;
    private tolerance: number;
    private dimensions: Dimensions;
    private visitedIndices: Set<number>;

    get bucketTolerance(): number {
        return this.tolerance;
    }

    set bucketTolerance(newTolerance: number) {
        this.tolerance = Math.min(Math.max(MIN_TOLERANCE, newTolerance), MAX_TOLERANCE);
    }

    constructor(drawingService: DrawingService) {
        super(drawingService);
        this.name = ToolNames.Bucket;
        this.key = ToolKeys.Bucket;
        this.tolerance = DEFAULT_TOLERANCE;
    }

    onMouseDown(event: MouseEvent): void {
        this.mouseDown = event.button === MouseButton.Left || event.button === MouseButton.Right;
        if (!this.mouseDown) return;
        this.drawingService.clearCanvas(this.drawingService.previewCtx);
        this.mouseDownCoord = this.getPositionFromMouse(event);
        this.setColors();
        this.updateDimensions();
        this.initializeData();
        if (event.button === MouseButton.Right) {
            this.nonAdjacentChange();
        }
        if (event.button === MouseButton.Left) {
            this.adjacentChange();
        }
    }

    onMouseUp(event: MouseEvent): void {
        if (!this.mouseDown) return;
        this.mouseDown = false;
        this.drawingService.saveCanvas();
    }

    private initializeData(): void {
        this.oldImageData = this.drawingService.baseCtx.getImageData(0, 0, this.dimensions.width, this.dimensions.height);
        this.imageDataToPut = new ImageData(this.dimensions.width, this.dimensions.height);
        for (let i = 0; i < this.imageDataToPut.data.length; i++) {
            this.imageDataToPut.data[i] = 0;
        }
    }

    private nonAdjacentChange(): void {
        this.changeImageData(this.drawingService.baseCtx);
        this.draw();
        this.addCommand();
    }

    private adjacentChange(): void {
        this.dfs();
        this.draw();
        this.addCommand();
    }

    private changeImageData(ctx: CanvasRenderingContext2D): void {
        for (let index = 0; index < this.oldImageData.data.length; index += COLOR_DATA_SIZE) {
            if (!this.isSameColor(index)) continue;
            this.changePointColor(index);
        }
    }

    private dfs(): void {
        this.floorCoordinates();
        this.visitedIndices = new Set<number>();
        let index = this.cartesianToIndex({ x: this.mouseDownCoord.x, y: this.mouseDownCoord.y });
        const indicesStack = [index];
        while (indicesStack.length) {
            index = indicesStack.pop() as number;
            if (!this.isSameColor(index) || this.visitedIndices.has(index)) {
                continue;
            }
            this.visitedIndices.add(index);
            this.changePointColor(index);

            const position = this.indexToCartesian(index);
            if (position.x > 0) indicesStack.push(index - COLOR_DATA_SIZE);
            if (position.x < this.dimensions.width - 1) indicesStack.push(index + COLOR_DATA_SIZE);
            if (position.y > 0) indicesStack.push(index - this.dimensions.width * COLOR_DATA_SIZE);
            if (position.y < this.dimensions.height - 1) indicesStack.push(index + this.dimensions.width * COLOR_DATA_SIZE);
        }
    }

    private floorCoordinates(): void {
        this.mouseDownCoord = { x: Math.floor(this.mouseDownCoord.x), y: Math.floor(this.mouseDownCoord.y) };
        this.dimensions = { width: Math.floor(this.dimensions.width), height: Math.floor(this.dimensions.height) };
    }

    private indexToCartesian(index: number): Vec2 {
        return { x: (index / COLOR_DATA_SIZE) % this.dimensions.width, y: Math.floor(index / COLOR_DATA_SIZE / this.dimensions.width) };
    }

    private cartesianToIndex(coordinates: Vec2): number {
        return this.dimensions.width * coordinates.y * COLOR_DATA_SIZE + coordinates.x * COLOR_DATA_SIZE;
    }

    private changePointColor(index: number): void {
        this.imageDataToPut.data[index + ColorData.Red] = this.newColor[ColorData.Red];
        this.imageDataToPut.data[index + ColorData.Green] = this.newColor[ColorData.Green];
        this.imageDataToPut.data[index + ColorData.Blue] = this.newColor[ColorData.Blue];
        this.imageDataToPut.data[index + ColorData.Alpha] = this.newColor[ColorData.Alpha];
    }

    private isSameColor(pointIndex: number): boolean {
        const redDistance = Math.abs(this.oldImageData.data[pointIndex + ColorData.Red] - this.clickedColor[ColorData.Red]);
        const greenDistance = Math.abs(this.oldImageData.data[pointIndex + ColorData.Green] - this.clickedColor[ColorData.Green]);
        const blueDistance = Math.abs(this.oldImageData.data[pointIndex + ColorData.Blue] - this.clickedColor[ColorData.Blue]);
        const alphaDistance = Math.abs(this.oldImageData.data[pointIndex + ColorData.Alpha] - this.clickedColor[ColorData.Alpha]);
        const distance = redDistance + greenDistance + blueDistance;
        const ratioColor = (distance / MAX_COLOR_DISTANCE) * HUNDRED_PERCENT;
        const ratioAlpha = (alphaDistance / MAX_RGB) * HUNDRED_PERCENT;
        return ratioColor <= this.tolerance && ratioAlpha <= this.tolerance;
    }

    draw(): void {
        this.drawingService.previewCtx.putImageData(this.imageDataToPut, 0, 0);
        this.drawingService.baseCtx.drawImage(this.drawingService.previewCtx.canvas, 0, 0);
        this.drawingService.clearCanvas(this.drawingService.previewCtx);
    }

    private setColors(): void {
        const imageData = this.drawingService.baseCtx.getImageData(this.mouseDownCoord.x, this.mouseDownCoord.y, 1, 1).data;
        this.clickedColor = new Uint8ClampedArray([
            imageData[ColorData.Red],
            imageData[ColorData.Green],
            imageData[ColorData.Blue],
            imageData[ColorData.Alpha],
        ]);
        const primaryColor = this.drawingService.colorService.primaryColor;
        this.newColor = new Uint8ClampedArray([primaryColor.red, primaryColor.green, primaryColor.blue, primaryColor.alpha * MAX_RGB]);
    }

    private updateDimensions(): void {
        this.dimensions = { width: this.drawingService.canvas.width, height: this.drawingService.canvas.height };
    }

    addCommand(): void {
        const currentState = new BucketState(
            1,
            this.drawingService.colorService.primaryColor,
            this.drawingService.colorService.secondaryColor,
            this.imageDataToPut,
        );
        const command = new BucketCommand(this, currentState, this.drawingService.colorService);
        this.drawingService.undoRedoService.addCommand(command);
    }
}
