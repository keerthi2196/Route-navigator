import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { CONFIG } from './config';
import { HttpModule } from '@angular/http';

import { AppComponent } from './app.component';
import { AgmCoreModule } from '@agm/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    ReactiveFormsModule,
    AgmCoreModule.forRoot({
      apiKey: CONFIG.GOOGLE_API_KEY,
      libraries: ['places', 'geometry']
  }),
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
