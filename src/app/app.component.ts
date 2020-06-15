/// <reference types="@types/googlemaps" />

import { Component, OnInit, ViewChild, ElementRef, NgZone, OnDestroy, Output, Input, EventEmitter } from '@angular/core';
import { FormControl } from '@angular/forms';
import { AgmMap, MapsAPILoader } from '@agm/core';
import { Http } from "@angular/http";

import * as _ from 'lodash';

class Address {
    id?: number;
    street?: string;
    additionalInfo?: string;
    lat?: number;
    lng?: number;
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
    autoComplete: google.maps.places.Autocomplete;
    autoCompleteDest: google.maps.places.Autocomplete;

    directionsService: google.maps.DirectionsService;
    directionsRequest: google.maps.DirectionsRequest;
    directionsDisplay: google.maps.DirectionsRenderer;

    distance: number;
    distancePrice: number;
    taxPrice: number;

    addresses: Address[];

    // markers labels
    alphabeticLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    labelIndex: number;

    // google maps zoom level
    zoom = 4;

    // initial center position for the map
    lat = 17.387140;
    lng = 78.491684;

    searchControl: FormControl;
    searchControlDest: FormControl;

    markers: any[] = [];

    readonly TAX = 4;

    idListener: google.maps.MapsEventListener;

    @ViewChild('search') public searchElement: ElementRef;
    @ViewChild('searchDest') public searchDestElement: ElementRef;
    @ViewChild(AgmMap) public maps: AgmMap;
    routeJSON:string= "Route JSON will be displayed here.";

    PYTHON_API_ENDPOINT = 'http://localhost:5000';


    constructor(
        private mapsApiLoader: MapsAPILoader,
        private ngZone: NgZone,
        private http: Http

    ) { }

    ngOnInit() {
        this.searchControl = new FormControl();
        this.searchControlDest = new FormControl();
        this.initializeRouteAndComponents();
        this.setGoogleMaps();

    }

    setGoogleMaps(): void {
        this.maps.mapReady.subscribe(
            mapReady => this.directionsDisplay.setMap(mapReady),
            e => console.log('Error setting map in DirectionRenderer', e)
        );

        this.labelIndex = 0;

        this.mapsApiLoader
            .load()
            .then(() => {
                // services have to be initialized inside MapsApiLoader to work
                this.initializeGoogleMapsServices();

                this.setPlacesAutocomplete();

                // workaround to restrict Autocomplete to get addresses within the chosen city boundaries
                this.maps.boundsChange.subscribe(bounds => this.autoComplete.setBounds(bounds));

                this.setupPlaceChangedListener();
            })
            .catch(e => console.log('Error loading MapsApi', e));
    }

    setupPlaceChangedListener(): void {
        this.idListener = this.autoComplete.addListener('place_changed', () => {
            this.placeChanged(this.autoComplete, 'source');
        });

        this.idListener = this.autoCompleteDest.addListener('place_changed', () => {
            this.placeChanged(this.autoCompleteDest, 'destination');
        });
    }

    private placeChanged(placeLocation: google.maps.places.Autocomplete, location: string) {
        console.log('Setting listener');
        this.ngZone.run(() => {
            const place = placeLocation.getPlace();
            if (!place.place_id || place.geometry === undefined || place.geometry === null) {
                console.log('Place not found');
                return;
            }
            const latitude = place.geometry.location.lat();
            const longitude = place.geometry.location.lng();
            // const address = {
            //     street: place.formatted_address,
            //     additionalInfo: '',
            //     lat: latitude,
            //     lng: longitude
            // } as Address;
            // this.addresses.push(address);
            if (location == 'source') {
                if (this.markers.length == 0)
                    this.markers.push({
                        lat: latitude,
                        lng: longitude,
                        label: this.alphabeticLabels[this.labelIndex++ % this.alphabeticLabels.length]
                    });
                else {
                    this.markers[0].lat = latitude;
                    this.markers[0].lng = longitude;
                }
            }
            else if (location == 'destination') {
                if (this.markers.length == 1)
                    this.markers.push({
                        lat: latitude,
                        lng: longitude,
                        label: this.alphabeticLabels[this.labelIndex++ % this.alphabeticLabels.length]
                    });
                else {
                    this.markers[1].lat = latitude;
                    this.markers[1].lng = longitude;
                }
            }
            if(this.markers.length > 1){
                this.routejson();
            }

            console.log('Markers list: ', JSON.stringify(this.markers));
        });
    }
    routejson(): void {
        this.http
            .post(this.PYTHON_API_ENDPOINT + "/get_route", {
                source: this.autoComplete.getPlace().address_components[0].long_name
                ,
                destination: this.autoCompleteDest.getPlace().address_components[0].long_name

            })
            .subscribe(
                data => {
                    this.routeJSON = (<any>data)._body;
            

                    
                });
    }

    drawRoute(): void {
        const length = this.markers.length;
        if (!(length >= 2)) {
            return;
        }

        this.setDirectionsRequest();

        if (length > 2) {
            if (length >= 12) {
                console.log('Google taxes for more than 10 waypoints. Be careful');
                return;
            }
            const waypoints: google.maps.DirectionsWaypoint[] = [];
            this.markers.slice(1, this.markers.length - 1)
                .forEach(coordinates => {
                    const way: google.maps.DirectionsWaypoint = { location: coordinates, stopover: null };
                    waypoints.push(way);
                });
            this.directionsRequest.waypoints = waypoints;
            console.log('Waypoints: ', JSON.stringify(waypoints));
        }

        this.callDirectionServiceRoute();

    }

    setDirectionsRequest(): void {
        this.directionsRequest.origin = _.first(this.markers);
        this.directionsRequest.destination = _.last(this.markers);
        this.directionsRequest.travelMode = google.maps.TravelMode.DRIVING;
        this.directionsRequest.optimizeWaypoints = true;
    }

    callDirectionServiceRoute(): void {
        this.directionsService.route(
            this.directionsRequest,
            (
                response: google.maps.DirectionsResult,
                status: google.maps.DirectionsStatus
            ) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    this.directionsDisplay.setDirections(response);
                    this.calcDistance(response);
                } else {
                    console.log('Failed to display directions');
                }
            }
        );
    }

    calcDistance(response: google.maps.DirectionsResult) {
        const route: google.maps.DirectionsRoute = response.routes[0];
        let distance = 0;
        for (let i = 0; i < route.legs.length; i++) {
            distance += route.legs[i].distance.value;
        }
        this.distance = parseFloat((distance / 1000).toFixed(2));
        console.log('Distance total: ', this.distance);
    }

    trackByIndex(index: number, obj: any): any {
        return index;
    }

    ngOnDestroy() {
        google.maps.event.removeListener(this.idListener);
    }

    initializeGoogleMapsServices(): void {
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRequest = {} as google.maps.DirectionsRequest;
        this.directionsDisplay = new google.maps.DirectionsRenderer();
    }

    setPlacesAutocomplete(): void {
        this.autoComplete = new google.maps.places.Autocomplete(this.searchElement.nativeElement);
        this.autoComplete.setTypes(['address']);
        //this.autoComplete.setComponentRestrictions({country: 'br'});

        this.autoCompleteDest = new google.maps.places.Autocomplete(this.searchDestElement.nativeElement);
        this.autoCompleteDest.setTypes(['address']);
    }

    initializeRouteAndComponents(): void {
        this.addresses = [];
        this.markers = [];
    }
    clearAddress(): void {
        this.addresses = [];
    }
}
