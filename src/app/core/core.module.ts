import {
    NgModule,
    Optional, SkipSelf
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { ErrorHandler } from '@angular/core';

import { SharedModule } from '../shared/shared.module';
import { NavComponent } from './nav/nav.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';
// import { QanErrorHandler } from './qan-error.handler';
import { InstanceService } from './instance.service';

@NgModule({
    imports: [CommonModule, SharedModule],
    declarations: [NavComponent, PageNotFoundComponent],
    exports: [NavComponent, PageNotFoundComponent],
    providers: [InstanceService]
})
export class CoreModule {

    constructor( @Optional() @SkipSelf() parentModule: CoreModule) {
        if (parentModule) {
            throw new Error(
                'CoreModule is already loaded. Import it in the AppModule only');
        }
    }
}