<script setup>
    import { RouterLink } from 'vue-router'
    // ADD YOUR CODE HERE
    const props = defineProps(['navigationitems'])




    // END OF ADDING YOUR CODE HERE

</script>

<template>
    <!-- ADD YOUR CODE HERE -->

    <nav class="navbar navbar-expand bg-body-tertiary bg-dark text-light">
        <div class="container-fluid">
            <a class="navbar-brand" href="#">Leaf it to us</a>
            <!-- <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
                data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false"
                aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button> -->
            <div>
                <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                    <li class="nav-item" v-for="(navItem,idx) of navigationitems" :key="idx">
                        <a class="nav-link active" :href="navItem.to">{{ navItem.label }}</a>
                    </li>
        
                </ul>
                <!-- <form class="d-flex" role="search">
                    <input class="form-control me-2" type="search" placeholder="Search" aria-label="Search" />
                    <button class="btn btn-outline-success" type="submit">Search</button>
                </form> -->
            </div>
        </div>
    </nav>

 


















    <!-- END OF ADDING YOUR CODE HERE -->
</template>

<style scoped>
/* Scoped styles for this component (optional) */
</style>
