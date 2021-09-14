import { Component } from '@angular/core';
import { DRAWING_DELAY } from '@app/classes/constants';
import { CanvasOperationsService } from '@app/services/canvas-operations/canvas-operations.service';
import { DrawingService } from '@app/services/drawing/drawing.service';

@Component({
    selector: 'app-confirmation-dialog',
    templateUrl: './confirmation-dialog.component.html',
    styleUrls: ['./confirmation-dialog.component.scss'],
})
export class ConfirmationDialogComponent {
    constructor(public drawingService: DrawingService, private canvasService: CanvasOperationsService) {}

    onConfirm(): void {
        this.canvasService.setDefaultDimensions();
        setTimeout(() => {
            this.drawingService.clearSavedCanvas();
            this.drawingService.newCanvas();
        }, DRAWING_DELAY);
    }
}
